import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { registerSchema, loginSchema } from '../schemas/assets.js';
import { getSettings } from '../services/settings.service.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { email: string; password: string; name: string } }>('/register', { schema: registerSchema }, async (request, reply) => {
    try {
      const { email, password, name } = request.body;

      const existingUser = await fastify.db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingUser) {
        return reply.status(409).send({ error: 'El correo electrónico ya está registrado' });
      }

      const allUsers = await fastify.db.query.users.findMany();
      const isFirstUser = allUsers.length === 0;

      const settings = await getSettings(fastify);
      if (!isFirstUser && !settings.allowRegistration) {
        return reply.status(403).send({ error: 'El registro público de nuevos usuarios está deshabilitado en esta instancia.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const role = isFirstUser ? 'admin' : 'viewer';

      const [user] = await fastify.db
        .insert(users)
        .values({
          email,
          passwordHash,
          name,
          role
        })
        .returning();

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role
      });

      return reply.status(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        token
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Error interno del servidor' });
    }
  });

  fastify.post<{ Body: { email: string; password: string } }>('/login', { schema: loginSchema }, async (request, reply) => {
    try {
      const { email, password } = request.body;

      const user = await fastify.db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Correo o contraseña incorrectos' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Correo o contraseña incorrectos' });
      }

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role as 'admin' | 'editor' | 'viewer'
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Error interno del servidor' });
    }
  });

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = request.currentUser!.userId;
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    return reply.send({ message: 'Logged out successfully' });
  });
}
