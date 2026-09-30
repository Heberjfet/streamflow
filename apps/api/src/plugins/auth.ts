import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { createHash, randomBytes } from 'crypto';

interface CurrentUser {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  orgId?: string;
  orgRole?: 'owner' | 'admin' | 'member';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAny: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    orgAdminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    generateApiKey: () => { key: string; keyHash: string; keyPrefix: string };
    hashApiKey: (key: string) => string;
  }
  interface FastifyRequest {
    currentUser: CurrentUser | null;
    orgId: string | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      role: 'admin' | 'editor' | 'viewer';
      orgId?: string;
    };
    user: CurrentUser;
  }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `sk_live_${randomBytes(24).toString('hex')}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.slice(0, 12);
  return { key, keyHash, keyPrefix };
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    sign: {
      expiresIn: '7d'
    }
  });

  fastify.decorate('generateApiKey', generateApiKey);
  fastify.decorate('hashApiKey', hashApiKey);

  const authenticateFn = async function(request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify();
      const user = decoded as CurrentUser;
      request.currentUser = user;
      request.orgId = user.orgId || null;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  };

  const authenticateApiKeyFn = async function(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer sk_live_')) {
      reply.status(401).send({ error: 'Invalid API key' });
      return;
    }

    const key = authHeader.slice(7);
    const keyHash = hashApiKey(key);
    const keyPrefix = key.slice(0, 12);

    const [apiKey] = await fastify.db.query.apiKeys.findMany({
      where: (apiKeys, { and, eq }) => and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.keyPrefix, keyPrefix)
      )
    });

    if (!apiKey) {
      reply.status(401).send({ error: 'Invalid API key' });
      return;
    }

    request.orgId = apiKey.orgId;
    request.currentUser = null;
  };

  const authenticateAnyFn = async function(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer sk_live_')) {
      return authenticateApiKeyFn(request, reply);
    }

    if (authHeader?.startsWith('Bearer ')) {
      return authenticateFn(request, reply);
    }

    reply.status(401).send({ error: 'Unauthorized' });
  };

  fastify.decorate('authenticate', authenticateFn);
  fastify.decorate('authenticateApiKey', authenticateApiKeyFn);
  fastify.decorate('authenticateAny', authenticateAnyFn);

  const adminOnlyFn = async function(request: FastifyRequest, reply: FastifyReply) {
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

  const orgAdminOnlyFn = async function(request: FastifyRequest, reply: FastifyReply) {
    if (request.currentUser?.orgRole === 'owner' || request.currentUser?.orgRole === 'admin') {
      return;
    }
    if (request.currentUser?.role === 'admin') {
      return;
    }
    reply.status(403).send({ error: 'Forbidden: Organization admin access required' });
    return;
  };

  fastify.decorate('adminOnly', adminOnlyFn);
  fastify.decorate('orgAdminOnly', orgAdminOnlyFn);
});