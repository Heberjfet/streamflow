import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';

interface UserQuery {
  page?: string;
  limit?: string;
  search?: string;
  role?: string;
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    try {
      const query = request.query as UserQuery;
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '20');
      const offset = (page - 1) * limit;

      const whereClause: ReturnType<typeof eq> | undefined = query.role && query.role !== 'all'
        ? eq(users.role, query.role)
        : undefined;

      const usersList = await fastify.db.query.users.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)]
      });

      const allUsers = await fastify.db.query.users.findMany();
      const total = allUsers.length;

      return reply.send({
        data: usersList.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          avatarUrl: u.avatarUrl,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, id)
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put<{ Params: { id: string }; Body: { name?: string; email?: string; role?: 'admin' | 'editor' | 'viewer'; password?: string } }>('/:id', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, email, role, password } = request.body;

      const existingUser = await fastify.db.query.users.findFirst({
        where: eq(users.id, id)
      });

      if (!existingUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

      const [updatedUser] = await fastify.db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      return reply.send({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Body: { email: string; name: string; password: string; role?: 'admin' | 'editor' | 'viewer' } }>('/', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    try {
      const { email, name, password, role = 'viewer' } = request.body;

      const existingUser = await fastify.db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (existingUser) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const [newUser] = await fastify.db
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role
        })
        .returning();

      return reply.status(201).send({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    try {
      const { id } = request.params;

      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, id)
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      if (user.role === 'admin') {
        const allAdmins = await fastify.db.query.users.findMany({
          where: eq(users.role, 'admin')
        });
        if (allAdmins.length <= 1) {
          return reply.status(400).send({ error: 'Cannot delete the last admin user' });
        }
      }

      await fastify.db.delete(users).where(eq(users.id, id));

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
