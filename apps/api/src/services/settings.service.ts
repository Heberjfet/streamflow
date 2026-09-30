import { FastifyInstance } from 'fastify';
import { DEFAULT_TRANSCODE_PROFILES, DEFAULT_ALLOWED_EXTENSIONS, Settings } from '../db/schema.js';

/** Devuelve la fila única de ajustes, creándola con valores por defecto si no existe. */
export async function getSettings(fastify: FastifyInstance): Promise<Settings> {
  const [existing] = await fastify.db.select().from(fastify.schema.settings).limit(1);
  if (existing) return existing;

  const [created] = await fastify.db
    .insert(fastify.schema.settings)
    .values({
      id: 'default',
      transcodeProfiles: DEFAULT_TRANSCODE_PROFILES,
      allowedExtensions: DEFAULT_ALLOWED_EXTENSIONS,
      encoder: 'libx264'
    })
    .returning();

  return created;
}
