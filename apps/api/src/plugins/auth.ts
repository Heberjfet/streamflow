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

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
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
