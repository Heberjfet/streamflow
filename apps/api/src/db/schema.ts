import { pgTable, text, timestamp, varchar, integer, uuid, boolean, jsonb, index, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow()
});

export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  assetCategoryUnique: unique('asset_cat_unique').on(table.assetId, table.categoryId)
}));

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  progress: integer('progress').notNull().default(0),
  playbackId: varchar('playback_id', { length: 255 }).unique(),
  duration: integer('duration'),
  thumbnailKey: varchar('thumbnail_key', { length: 500 }),
  hlsManifestKey: varchar('hls_manifest_key', { length: 500 }),
  sourceKey: varchar('source_key', { length: 500 }),
  sourceType: varchar('source_type', { length: 50 }).default('upload'),
  views: integer('views').default(0),
  allowDownload: boolean('allow_download').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  statusIdx: index('assets_status_idx').on(table.status),
  userIdIdx: index('assets_user_id_idx').on(table.userId)
}));

// Ajustes globales (fila única, id = 'default')
export const settings = pgTable('settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  transcodeProfiles: jsonb('transcode_profiles').notNull(),
  allowedExtensions: jsonb('allowed_extensions').notNull(),
  encoder: varchar('encoder', { length: 50 }).notNull().default('libx264'),
  concurrency: integer('concurrency'),
  ffmpegThreads: integer('ffmpeg_threads'),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const schema = {
  users,
  categories,
  assetCategories,
  assets,
  settings
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Settings = typeof settings.$inferSelect;

export interface TranscodeProfile {
  quality: string;
  width: number;
  height: number;
  bitrateKbps: number;
  codec: 'h264' | 'h265';
  active: boolean;
}

export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
} as const;

export const ASSET_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
} as const;

export const DEFAULT_TRANSCODE_PROFILES: TranscodeProfile[] = [
  { quality: '360p', width: 640, height: 360, bitrateKbps: 1000, codec: 'h264', active: true },
  { quality: '480p', width: 854, height: 480, bitrateKbps: 1800, codec: 'h264', active: true },
  { quality: '720p', width: 1280, height: 720, bitrateKbps: 3000, codec: 'h264', active: true },
  { quality: '1080p', width: 1920, height: 1080, bitrateKbps: 6000, codec: 'h264', active: true },
  { quality: '1440p', width: 2560, height: 1440, bitrateKbps: 12000, codec: 'h264', active: false },
  { quality: '2160p', width: 3840, height: 2160, bitrateKbps: 24000, codec: 'h264', active: false }
];

export const DEFAULT_ALLOWED_EXTENSIONS = [
  'mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v', 'mpg', 'mpeg', 'ts', 'flv', 'wmv', '3gp'
];

export const AVAILABLE_ENCODERS = [
  { id: 'libx264', label: 'CPU — H.264 (libx264)', hardware: false },
  { id: 'libx265', label: 'CPU — H.265 (libx265)', hardware: false },
  { id: 'h264_vaapi', label: 'GPU — VAAPI (Linux/Intel/AMD)', hardware: true },
  { id: 'h264_nvenc', label: 'GPU — NVIDIA NVENC', hardware: true },
  { id: 'h264_qsv', label: 'GPU — Intel Quick Sync', hardware: true }
];
