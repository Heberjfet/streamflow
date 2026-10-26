import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import authPlugin from './plugins/auth.js';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import s3Plugin from './plugins/s3.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { assetRoutes } from './routes/assets.js';
import { playbackRoutes } from './routes/playback.js';
import { categoryRoutes } from './routes/categories.js';
import { settingsRoutes } from './routes/settings.js';
import { adminRoutes } from './routes/admin.js';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: 'info'
    }
  });

  const rawOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...rawOrigins]));
  const allowAllOrigins = rawOrigins.includes('*');

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Peticiones sin cabecera origin (curl, server-to-server, SSR)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowAllOrigins || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      // Permitir orígenes locales y de red privada (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
      try {
        const { hostname } = new URL(origin);
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
        ) {
          cb(null, true);
          return;
        }
      } catch {
        // origin no es una URL válida
      }
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  });

  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(s3Plugin);

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 * 1024
    }
  });

  await fastify.register(authPlugin);

  await fastify.register(authRoutes, { prefix: '/v1/auth' });
  await fastify.register(userRoutes, { prefix: '/v1/users' });
  await fastify.register(assetRoutes, { prefix: '/v1/assets' });
  await fastify.register(playbackRoutes, { prefix: '/v1/playback' });
  await fastify.register(categoryRoutes, { prefix: '/v1/categories' });
  await fastify.register(settingsRoutes, { prefix: '/v1/settings' });
  await fastify.register(adminRoutes, { prefix: '/v1/admin' });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.message
      });
    }

    return reply.status(500).send({
      error: 'Internal server error'
    });
  });

  return fastify;
}

const app = await buildApp();

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { buildApp };
