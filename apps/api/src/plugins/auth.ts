import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';

interface CurrentUser {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser: CurrentUser | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      role: 'admin' | 'editor' | 'viewer';
    };
    user: CurrentUser;
  }
}

const JWT_SECRET_DEFAULTS = new Set([
  'change-this-in-production',
  'dev-secret-change-in-production',
  'your-secret-key-change-in-production'
]);

export default fp(async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fallar al arranque es mejor que permitir tokens forjables.
    throw new Error('JWT_SECRET no está definido. Configurá la variable de entorno con un secreto largo y aleatorio.');
  }
  if (JWT_SECRET_DEFAULTS.has(secret)) {
    fastify.log.warn('JWT_SECRET usa un valor por defecto conocido. Cambialo en producción.');
  }

  await fastify.register(fastifyJwt, {
    secret,
    sign: {
      expiresIn: '7d'
    }
  });

  const authenticateFn = async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify();
      request.currentUser = decoded as CurrentUser;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  };

  fastify.decorate('authenticate', authenticateFn);

  const adminOnlyFn = async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify();
      const user = decoded as CurrentUser;
      if (user.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin access required' });
      }
      request.currentUser = user;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  };

  fastify.decorate('adminOnly', adminOnlyFn);
});
