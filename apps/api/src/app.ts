import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import s3Plugin from './plugins/s3.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { assetRoutes } from './routes/assets.js';
import { playbackRoutes } from './routes/playback.js';
import { categoryRoutes } from './routes/categories.js';
import { adminRoutes } from './routes/admin.js';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: 'info'
    }
  });

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:3000'];
  const allowAllOrigins = allowedOrigins.includes('*');

  await fastify.register(cors, {
    origin: allowAllOrigins ? true : allowedOrigins,
    // No se puede combinar el comodín '*' con credenciales.
    credentials: !allowAllOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });

  await fastify.register(dbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(s3Plugin);

  await fastify.register(authPlugin);

  await fastify.register(authRoutes, { prefix: '/v1/auth' });
  await fastify.register(userRoutes, { prefix: '/v1/users' });
  await fastify.register(assetRoutes, { prefix: '/v1/assets' });
  await fastify.register(playbackRoutes, { prefix: '/v1/playback' });
  await fastify.register(categoryRoutes, { prefix: '/v1/categories' });
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
