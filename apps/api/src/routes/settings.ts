import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { getSettings } from '../services/settings.service.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Lectura pública sin autenticación (para verificar si el registro está abierto y si ya existen usuarios)
  fastify.get('/public', async (_request, reply) => {
    try {
      const settings = await getSettings(fastify);
      const userCountResult = await fastify.db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const hasUsers = Number(userCountResult[0]?.count || 0) > 0;

      return reply.send({
        allowRegistration: settings.allowRegistration,
        hasUsers
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Lectura para el frontend autenticado (lista de formatos aceptados, calidades, etc.)
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const settings = await getSettings(fastify);
      return reply.send({
        transcodeProfiles: settings.transcodeProfiles,
        allowedExtensions: settings.allowedExtensions,
        encoder: settings.encoder,
        concurrency: settings.concurrency,
        ffmpegThreads: settings.ffmpegThreads,
        allowRegistration: settings.allowRegistration
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
