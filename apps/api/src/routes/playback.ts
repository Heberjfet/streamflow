import { FastifyInstance } from 'fastify';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3Service } from '../services/s3.service.js';

interface PlaybackParams {
  playbackId: string;
}

export async function playbackRoutes(fastify: FastifyInstance) {
  const s3Service = new S3Service(fastify.s3, fastify.s3Config);

  fastify.get<{ Params: PlaybackParams }>('/:playbackId', async (request, reply) => {
    try {
      const { playbackId } = request.params;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.playbackId, playbackId)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.status !== 'ready') {
        return reply.status(400).send({ error: 'Asset not ready for playback' });
      }

      const manifestUrl = s3Service.getPublicUrl(asset.hlsManifestKey || '');
      const thumbnailUrl = asset.thumbnailKey
        ? s3Service.getPublicUrl(asset.thumbnailKey)
        : null;

      return reply.send({
        manifestUrl,
        thumbnailUrl,
        title: asset.title,
        description: asset.description,
        duration: asset.duration,
        playbackId,
        allowDownload: asset.allowDownload
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: PlaybackParams }>('/:playbackId/download', async (request, reply) => {
    try {
      const { playbackId } = request.params;
      const quality = (request.query as { quality?: string }).quality;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.playbackId, playbackId)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (!asset.allowDownload) {
        return reply.status(403).send({ error: 'Download not allowed' });
      }

      if (quality && quality !== 'original' && !/^[a-zA-Z0-9]{1,10}$/.test(quality)) {
        return reply.status(400).send({ error: 'Calidad inválida' });
      }

      // Convención: los MP4 descargables viven fuera del prefijo HLS público
      // (assets/{id}/downloads/) para no eludir el flag allowDownload.
      let downloadKey: string;
      if (quality && quality !== 'original') {
        downloadKey = `assets/${asset.id}/downloads/${quality}.mp4`;
      } else if (asset.sourceKey) {
        downloadKey = asset.sourceKey;
      } else {
        downloadKey = `assets/${asset.id}/downloads/720p.mp4`;
      }

      const fetchObject = async (key: string) => {
        try {
          return await fastify.s3.send(new GetObjectCommand({
            Bucket: fastify.s3Config.bucket,
            Key: key
          }));
        } catch (error) {
          const notFound =
            (error as { name?: string }).name === 'NoSuchKey' ||
            (error as { Code?: string }).Code === 'NoSuchKey';
          if (!notFound) throw error;
          return null;
        }
      };

      let s3Response = await fetchObject(downloadKey);
      // Compatibilidad: assets transcodificados con el layout viejo guardaban
      // download.mp4 dentro del prefijo HLS.
      if (!s3Response && quality && quality !== 'original' && asset.hlsManifestKey) {
        downloadKey = asset.hlsManifestKey.replace('/master.m3u8', `/${quality}/download.mp4`);
        s3Response = await fetchObject(downloadKey);
      }
      if (!s3Response) {
        return reply.status(404).send({ error: 'El archivo de descarga no existe en el storage' });
      }

      const filename = `${(asset.title || 'video').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      reply
        .header('Content-Type', 'video/mp4')
        .header('Content-Disposition', `attachment; filename="${filename}"`);
      if (s3Response.ContentLength) {
        reply.header('Content-Length', s3Response.ContentLength);
      }

      // Streaming server-side: memoria constante sin importar el tamaño, y sin
      // depender del endpoint interno de S3 que el navegador no puede alcanzar.
      return reply.send(s3Response.Body as Readable);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
