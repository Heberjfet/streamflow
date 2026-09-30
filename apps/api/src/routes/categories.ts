import { FastifyInstance } from 'fastify';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryParamsSchema
} from '../schemas/assets.js';

interface CreateCategoryBody {
  name: string;
  description?: string;
}

interface UpdateCategoryBody {
  name?: string;
  description?: string;
}

interface CategoryParams {
  id: string;
}

export async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = request.currentUser!.userId;
      const categories = await fastify.db.query.categories.findMany({
        where: (categories, { eq }) => eq(categories.userId, userId),
        orderBy: [fastify.desc(fastify.schema.categories.createdAt)]
      });

      return reply.send(categories);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Body: CreateCategoryBody }>('/', { onRequest: [fastify.authenticate], schema: categoryCreateSchema }, async (request, reply) => {
    try {
      const { name, description } = request.body;
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const [category] = await fastify.db
        .insert(fastify.schema.categories)
        .values({
          name,
          slug,
          description,
          userId: request.currentUser!.userId
        })
        .returning();

      return reply.status(201).send(category);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: CategoryParams }>('/:id', { schema: categoryParamsSchema }, async (request, reply) => {
    try {
      const { id } = request.params;

      const category = await fastify.db.query.categories.findFirst({
        where: fastify.eq(fastify.schema.categories.id, id)
      });

      if (!category) {
        return reply.status(404).send({ error: 'Category not found' });
      }

      return reply.send(category);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put<{ Params: CategoryParams; Body: UpdateCategoryBody }>('/:id', { onRequest: [fastify.authenticate], schema: { ...categoryParamsSchema, ...categoryUpdateSchema } }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, description } = request.body;
      const userId = request.currentUser!.userId;

      const existing = await fastify.db.query.categories.findFirst({
        where: fastify.eq(fastify.schema.categories.id, id)
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Category not found' });
      }

      if (existing.userId !== userId && request.currentUser!.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) {
        updates.name = name;
        updates.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (description !== undefined) updates.description = description;

      const [category] = await fastify.db
        .update(fastify.schema.categories)
        .set(updates)
        .where(fastify.eq(fastify.schema.categories.id, id))
        .returning();

      return reply.send(category);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete<{ Params: CategoryParams }>('/:id', { onRequest: [fastify.authenticate], schema: categoryParamsSchema }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const existing = await fastify.db.query.categories.findFirst({
        where: fastify.eq(fastify.schema.categories.id, id)
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Category not found' });
      }

      if (existing.userId !== userId && request.currentUser!.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await fastify.db
        .delete(fastify.schema.assetCategories)
        .where(fastify.eq(fastify.schema.assetCategories.categoryId, id));

      await fastify.db
        .delete(fastify.schema.categories)
        .where(fastify.eq(fastify.schema.categories.id, id));

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
