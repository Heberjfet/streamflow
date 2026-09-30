import { FastifyInstance } from 'fastify';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

      let downloadKey: string;
      if (quality && quality !== 'original') {
        downloadKey = asset.hlsManifestKey
          ? asset.hlsManifestKey.replace('/master.m3u8', `/${quality}/download.mp4`)
          : `assets/${asset.id}/hls/${quality}/download.mp4`;
      } else if (asset.sourceKey) {
        downloadKey = asset.sourceKey;
      } else {
        downloadKey = asset.hlsManifestKey
          ? asset.hlsManifestKey.replace('/master.m3u8', '/720p/download.mp4')
          : `assets/${asset.id}/hls/720p/download.mp4`;
      }

      const command = new GetObjectCommand({
        Bucket: fastify.s3Config.bucket,
        Key: downloadKey
      });
      const presignedUrl = await getSignedUrl(fastify.s3, command, { expiresIn: 3600 });

      const response = await fetch(presignedUrl);
      if (!response.ok) {
        return reply.status(404).send({ error: 'File not found in storage' });
      }

      const arrayBuffer = await response.arrayBuffer();
      const filename = `${(asset.title || 'video').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

      return reply
        .header('Content-Type', 'video/mp4')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', arrayBuffer.byteLength)
        .send(Buffer.from(arrayBuffer));
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
