import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import os from 'os';
import { sql, eq } from 'drizzle-orm';
import { getSettings } from '../services/settings.service.js';
import { AVAILABLE_ENCODERS } from '../db/schema.js';

interface StatsResponse {
  totalAssets: number;
  totalUsers: number;
  totalViews: number;
  assetsByStatus: Record<string, number>;
  recentAssets: Array<{
    id: string;
    title: string;
    status: string;
    views: number;
    createdAt: string;
  }>;
  systemInfo: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string; email: string; role: 'admin' | 'editor' | 'viewer'; name?: string };
      request.currentUser = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name || '',
        role: decoded.role
      };
    } catch (err) {
      fastify.log.error({ err }, 'JWT verify failed');
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (request.currentUser?.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden - Admin only' });
    }
  });

  fastify.get('/stats', async (request, reply) => {
    try {
      const assetsResult = await fastify.db.execute(sql`SELECT COUNT(*) as count FROM assets`);
      const usersResult = await fastify.db.execute(sql`SELECT COUNT(*) as count FROM users`);

      const totalAssets = Number(assetsResult[0]?.count || 0);
      const totalUsers = Number(usersResult[0]?.count || 0);

      const assets = await fastify.db
        .select({
          id: fastify.schema.assets.id,
          title: fastify.schema.assets.title,
          status: fastify.schema.assets.status,
          views: fastify.schema.assets.views,
          createdAt: fastify.schema.assets.createdAt
        })
        .from(fastify.schema.assets)
        .orderBy(fastify.desc(fastify.schema.assets.createdAt))
        .limit(10);

      const assetsByStatus: Record<string, number> = {};
      for (const asset of assets) {
        assetsByStatus[asset.status] = (assetsByStatus[asset.status] || 0) + 1;
      }

      const totalViews = assets.reduce((sum, a) => sum + (a.views || 0), 0);

      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return reply.send({
        totalAssets,
        totalUsers,
        totalViews,
        assetsByStatus,
        recentAssets: assets.map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          views: a.views || 0,
          createdAt: a.createdAt?.toISOString() || ''
        })),
        systemInfo: {
          uptime: process.uptime(),
          memoryUsage: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
          },
          cpuUsage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        }
      } as StatsResponse);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/logs', async (request, reply) => {
    try {
      const limit = parseInt((request.query as { limit?: string }).limit || '100');

      const assets = await fastify.db
        .select({
          id: fastify.schema.assets.id,
          title: fastify.schema.assets.title,
          status: fastify.schema.assets.status,
          views: fastify.schema.assets.views,
          createdAt: fastify.schema.assets.createdAt,
          updatedAt: fastify.schema.assets.updatedAt
        })
        .from(fastify.schema.assets)
        .orderBy(fastify.desc(fastify.schema.assets.updatedAt))
        .limit(limit);

      const users = await fastify.db
        .select({
          id: fastify.schema.users.id,
          email: fastify.schema.users.email,
          name: fastify.schema.users.name,
          role: fastify.schema.users.role,
          createdAt: fastify.schema.users.createdAt
        })
        .from(fastify.schema.users)
        .orderBy(fastify.desc(fastify.schema.users.createdAt))
        .limit(limit);

      return reply.send({
        assets,
        users,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: { userId: string } }>('/:userId/content', async (request, reply) => {
    try {
      const { userId } = request.params;

      const userAssets = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.userId, userId),
        orderBy: [fastify.desc(fastify.schema.assets.createdAt)],
        limit: 10
      });

      const userCategories = await fastify.db.query.categories.findMany({
        where: (categories, { eq }) => eq(categories.userId, userId),
        orderBy: [fastify.desc(fastify.schema.categories.createdAt)],
        limit: 10
      });

      return reply.send({
        assets: userAssets,
        categories: userCategories
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/system', async (_request, reply) => {
    const totalMemGB = os.totalmem() / (1024 ** 3);
    const freeMemGB = os.freemem() / (1024 ** 3);
    return reply.send({
      cpuCores: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'desconocido',
      totalMemGB: Math.round(totalMemGB * 10) / 10,
      freeMemGB: Math.round(freeMemGB * 10) / 10,
      platform: `${os.platform()} ${os.arch()}`,
      availableEncoders: AVAILABLE_ENCODERS
    });
  });

  fastify.get('/settings', async (_request, reply) => {
    const settings = await getSettings(fastify);
    return reply.send({ ...settings, availableEncoders: AVAILABLE_ENCODERS });
  });

  fastify.put<{ Body: { transcodeProfiles?: unknown[]; allowedExtensions?: string[]; encoder?: string; concurrency?: number; ffmpegThreads?: number } }>('/settings', async (request, reply) => {
    try {
      const settings = await getSettings(fastify);
      const { transcodeProfiles, allowedExtensions, encoder, concurrency, ffmpegThreads } = request.body;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (transcodeProfiles !== undefined) updates.transcodeProfiles = transcodeProfiles;
      if (allowedExtensions !== undefined) updates.allowedExtensions = allowedExtensions;
      if (encoder !== undefined) updates.encoder = encoder;
      if (concurrency !== undefined) updates.concurrency = concurrency;
      if (ffmpegThreads !== undefined) updates.ffmpegThreads = ffmpegThreads;

      const [updated] = await fastify.db
        .update(fastify.schema.settings)
        .set(updates)
        .where(eq(fastify.schema.settings.id, settings.id))
        .returning();

      return reply.send(updated);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
