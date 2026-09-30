import { FastifyInstance } from 'fastify';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Service } from '../services/s3.service.js';
import { AssetService } from '../services/asset.service.js';
import { ASSET_STATUS } from '../db/schema.js';

interface ListQuery {
  page?: number;
  limit?: number;
  categoryId?: string;
  status?: string;
}

interface CreateBody {
  title: string;
  description?: string;
  categoryId?: string;
}

interface AssetParams {
  id: string;
}

export async function assetRoutes(fastify: FastifyInstance) {
  const s3Service = new S3Service(fastify.s3, fastify.s3Config);
  const assetService = new AssetService(s3Service, fastify.transcodeQueue);

  fastify.get<{ Querystring: ListQuery }>('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const page = request.query.page || 1;
      const limit = request.query.limit || 20;
      const offset = (page - 1) * limit;

      const userId = request.currentUser!.userId;
      const assets = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.userId, userId),
        limit,
        offset,
        orderBy: [fastify.desc(fastify.schema.assets.createdAt)]
      });

      const assetIds = assets.map(a => a.id);
      const categoryMap: Record<string, string[]> = {};
      if (assetIds.length > 0) {
        const links = await fastify.db.query.assetCategories.findMany({
          where: (ac, { inArray }) => inArray(ac.assetId, assetIds)
        });
        for (const link of links) {
          if (!categoryMap[link.assetId]) categoryMap[link.assetId] = [];
          categoryMap[link.assetId].push(link.categoryId);
        }
      }

      const data = assets.map(asset => ({
        ...asset,
        categoryIds: categoryMap[asset.id] || []
      }));

      return reply.send({ data, page, limit });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Body: CreateBody }>('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { title, description, categoryId } = request.body;
      const playbackId = assetService.generatePlaybackId();

      const [asset] = await fastify.db
        .insert(fastify.schema.assets)
        .values({
          title,
          description,
          categoryId,
          userId: request.currentUser!.userId,
          playbackId,
          status: ASSET_STATUS.PENDING,
          allowDownload: true
        })
        .returning();

      return reply.status(201).send(asset);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: AssetParams }>('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      return reply.send(asset);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put<{ Params: AssetParams; Body: { categoryId?: string; categoryIds?: string[]; title?: string; description?: string } }>('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId && request.currentUser!.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { categoryId, categoryIds, title, description } = request.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;

      const targetCategoryIds = categoryIds !== undefined ? categoryIds : (categoryId !== undefined ? [categoryId] : undefined);
      if (targetCategoryIds !== undefined && categoryIds !== undefined) {
        await fastify.db
          .delete(fastify.schema.assetCategories)
          .where(fastify.eq(fastify.schema.assetCategories.assetId, id));
        if (targetCategoryIds.length > 0) {
          await fastify.db
            .insert(fastify.schema.assetCategories)
            .values(targetCategoryIds.map(catId => ({ assetId: id, categoryId: catId })));
        }
      }

      if (Object.keys(updates).length > 0) {
        await fastify.db
          .update(fastify.schema.assets)
          .set(updates)
          .where(fastify.eq(fastify.schema.assets.id, id));
      }

      const [updated] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id),
        limit: 1
      });

      let resultCategoryIds: string[] = [];
      if (targetCategoryIds !== undefined) {
        resultCategoryIds = targetCategoryIds;
      } else {
        const links = await fastify.db.query.assetCategories.findMany({
          where: (ac, { eq }) => eq(ac.assetId, id)
        });
        resultCategoryIds = links.map(l => l.categoryId);
      }

      return reply.send({ ...updated, categoryIds: resultCategoryIds });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: AssetParams; Body: { filename: string; contentType: string } }>('/:id/upload-url', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { filename, contentType } = request.body;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const key = s3Service.getAssetPath(userId, id, filename);
      const command = new PutObjectCommand({
        Bucket: fastify.s3Config.bucket,
        Key: key,
        ContentType: contentType
      });

      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const uploadUrl = await getSignedUrl(fastify.s3, command, { expiresIn: 3600 });

      await fastify.db
        .update(fastify.schema.assets)
        .set({ sourceKey: key, status: ASSET_STATUS.UPLOADING })
        .where(fastify.eq(fastify.schema.assets.id, id));

      return reply.send({
        uploadUrl,
        key,
        method: 'PUT'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: AssetParams }>('/:id/upload-complete', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      if (!asset.sourceKey) {
        return reply.status(400).send({ error: 'No upload pending for this asset' });
      }

      try {
        await fastify.s3.send(new HeadObjectCommand({
          Bucket: fastify.s3Config.bucket,
          Key: asset.sourceKey
        }));
      } catch {
        return reply.status(400).send({ error: 'File not found in S3. Upload may have failed.' });
      }

      await fastify.db
        .update(fastify.schema.assets)
        .set({ status: ASSET_STATUS.UPLOADED })
        .where(fastify.eq(fastify.schema.assets.id, id));

      return reply.send({ success: true, verified: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: AssetParams }>('/:id/upload', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const filename = 'original';
      const key = s3Service.getAssetPath(userId, id, filename);

      const buffer = await data.toBuffer();

      fastify.log.info(`Uploading ${buffer.length} bytes to S3: ${key}`);

      const command = new PutObjectCommand({
        Bucket: fastify.s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: data.mimetype
      });

      await fastify.s3.send(command);

      await fastify.db
        .update(fastify.schema.assets)
        .set({ sourceKey: key, status: ASSET_STATUS.UPLOADED })
        .where(fastify.eq(fastify.schema.assets.id, id));

      return reply.send({ success: true, key });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: AssetParams }>('/:id/process', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const inputKey = asset.sourceKey || `uploads/${userId}/${id}/original`;
      const jobId = await assetService.enqueueTranscodeJob(id, userId, inputKey);

      await fastify.db
        .update(fastify.schema.assets)
        .set({ status: ASSET_STATUS.PROCESSING })
        .where(fastify.eq(fastify.schema.assets.id, id));

      return reply.send({ jobId });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete<{ Params: AssetParams }>('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.currentUser!.userId;

      const [asset] = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.id, id)
      });

      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      if (asset.userId !== userId && request.currentUser!.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await fastify.db
        .delete(fastify.schema.assets)
        .where(fastify.eq(fastify.schema.assets.id, id));

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
