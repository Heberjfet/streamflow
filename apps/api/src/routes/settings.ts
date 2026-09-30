import { FastifyInstance } from 'fastify';
import { getSettings } from '../services/settings.service.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Lectura para el frontend (lista de formatos aceptados, calidades, etc.)
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const settings = await getSettings(fastify);
      return reply.send({
        transcodeProfiles: settings.transcodeProfiles,
        allowedExtensions: settings.allowedExtensions,
        encoder: settings.encoder,
        concurrency: settings.concurrency,
        ffmpegThreads: settings.ffmpegThreads
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
