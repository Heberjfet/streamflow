import { rm, mkdir, writeFile, stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { TranscodeJobData, computeWorkerConfig } from '../types';
import { ffprobe, runFfmpeg } from '../services/ffmpeg.service';
import { s3Service } from '../services/s3.service';
import {
  buildLadder,
  transcodeRendition,
  createDownloadableMp4,
  extractPosterThumbnail,
  createMasterPlaylist,
  DEFAULT_LADDER,
  RenditionProfile,
} from '../services/transcoding.service';
import postgres from 'postgres';

const MAX_ERROR_MESSAGE_LENGTH = 200;

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unknown worker error';
  return raw.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

async function updateAssetStatus(
  sql: ReturnType<typeof postgres>,
  assetId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed',
  outputKey?: string,
  thumbnailKey?: string,
  durationSec?: number,
  progress?: number
) {
  await sql`
    UPDATE assets
    SET status = ${status},
        hls_manifest_key = COALESCE(${outputKey ?? null}, hls_manifest_key),
        thumbnail_key = COALESCE(${thumbnailKey ?? null}, thumbnail_key),
        duration = COALESCE(${durationSec ?? null}, duration),
        progress = COALESCE(${progress ?? null}, progress),
        updated_at = NOW()
    WHERE id = ${assetId}
  `;
}

async function setProgress(sql: ReturnType<typeof postgres>, assetId: string, progress: number) {
  await sql`UPDATE assets SET progress = ${progress}, updated_at = NOW() WHERE id = ${assetId}`;
}

const workerConfig = computeWorkerConfig();

console.log('[Worker] Hardware-adaptive config:');
console.log(`  CPU cores:      ${workerConfig.cpuCores}`);
console.log(`  Total RAM:      ${workerConfig.totalMemGB.toFixed(1)} GB`);
console.log(`  Concurrency:    ${workerConfig.concurrency} job(s)`);
console.log(`  FFmpeg threads: ${workerConfig.ffmpegThreads} per job`);

export async function transcodeProcessor(job: { data: TranscodeJobData; updateProgress: (p: number) => Promise<void> }): Promise<void> {
  const { assetId, inputKey } = job.data;
  console.log(`[Transcode] Starting job for asset: ${assetId}`);

  const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const tmpDir = path.join(os.tmpdir(), `streamflow-${randomUUID()}`);
  const sourcePath = path.join(tmpDir, 'source.mp4');
  const outputDir = path.join(tmpDir, 'hls');
  await mkdir(outputDir, { recursive: true });

  try {
    // Ajustes globales (escalera, encoder y threads) definidos por el admin.
    const rows = await sql`SELECT transcode_profiles, encoder, ffmpeg_threads FROM settings LIMIT 1`;
    const settingsRow = (rows[0] ?? {}) as Record<string, unknown>;
    const profilesRaw = settingsRow.transcode_profiles as Array<Record<string, unknown>> | null | undefined;
    const encoder = (settingsRow.encoder as string) || 'libx264';
    const threads = (settingsRow.ffmpeg_threads as number | null) ?? workerConfig.ffmpegThreads;

    await updateAssetStatus(sql, assetId, 'processing', undefined, undefined, undefined, 0);
    await job.updateProgress(1);

    console.log(`[Transcode] Downloading source from S3: ${inputKey}`);
    await s3Service.downloadFile(inputKey, sourcePath);

    const fileStat = await stat(sourcePath);
    console.log(`[Transcode] Source: ${(fileStat.size / (1024 * 1024)).toFixed(1)} MB`);

    await job.updateProgress(5);

    console.log('[Transcode] Probing source video...');
    const probe = await ffprobe(sourcePath);
    console.log(`[Transcode] Source: ${probe.width}x${probe.height}, ${probe.duration.toFixed(1)}s`);

    if (probe.width === 0 || probe.height === 0) {
      throw new Error('Source video has no valid video stream');
    }

    await job.updateProgress(10);

    const sourceProfiles = ((profilesRaw && profilesRaw.length ? profilesRaw : DEFAULT_LADDER) as Array<Record<string, unknown>>)
      .filter(p => p.active !== false)
      .map(p => ({
        quality: String(p.quality),
        width: Number(p.width),
        height: Number(p.height),
        bitrateKbps: Number(p.bitrateKbps),
        codec: (p.codec === 'h265' ? 'h265' : 'h264') as 'h264' | 'h265',
      })) as RenditionProfile[];

    const ladder = buildLadder(sourceProfiles, probe.width, probe.height);
    if (ladder.length === 0) {
      throw new Error('No hay calidades de transcodificación configuradas');
    }

    console.log(`[Transcode] Encoder: ${encoder} | Ladder: ${ladder.map(p => p.quality).join(', ')}`);

    let completedSteps = 10;
    const stepSize = 70 / ladder.length;

    for (const profile of ladder) {
      console.log(`[Transcode] Transcoding ${profile.quality}...`);
      await transcodeRendition(sourcePath, outputDir, profile, probe.duration, threads, encoder);
      await createDownloadableMp4(outputDir, profile);

      completedSteps += stepSize;
      const p = Math.min(Math.round(completedSteps), 80);
      await job.updateProgress(p);
      await setProgress(sql, assetId, p);
    }

    console.log('[Transcode] Generating thumbnails...');
    await generateThumbnails(sourcePath, outputDir, probe.duration);
    await extractPosterThumbnail(sourcePath, outputDir, probe.duration);
    await job.updateProgress(85);
    await setProgress(sql, assetId, 85);

    console.log('[Transcode] Creating master playlist...');
    await createMasterPlaylist(outputDir, ladder);
    await job.updateProgress(90);
    await setProgress(sql, assetId, 90);

    console.log('[Transcode] Uploading to S3...');
    await s3Service.uploadFolder(outputDir, `assets/${assetId}/hls`);

    const masterKey = `assets/${assetId}/hls/master.m3u8`;
    const thumbnailKey = `assets/${assetId}/hls/thumbnail.jpg`;

    await updateAssetStatus(sql, assetId, 'ready', masterKey, thumbnailKey, Math.round(probe.duration), 100);
    await job.updateProgress(100);

    console.log(`[Transcode] Job completed for asset: ${assetId}`);

  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);
    console.error(`[Transcode] Job failed for asset ${assetId}:`, errorMessage);
    await updateAssetStatus(sql, assetId, 'failed');
    throw error;
  } finally {
    try {
      await sql.end();
    } catch {
      // ignorar
    }
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`[Transcode] Failed to clean up temp directory: ${tmpDir}`);
    }
  }
}

async function generateThumbnails(sourcePath: string, outputDir: string, durationSec: number): Promise<void> {
  const spriteDir = path.join(outputDir, 'sprite');
  await mkdir(spriteDir, { recursive: true });

  const count = 10;
  const interval = durationSec / count;
  const tempPattern = path.join(spriteDir, 'thumb_%04d.jpg');

  await runFfmpeg([
    '-y', '-i', sourcePath,
    '-vf', `fps=${1 / interval},scale=160:90,tile=${count}x1`,
    '-q:v', '2',
    tempPattern,
  ]);

  const spriteContent: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * interval;
    spriteContent.push(`thumb_${String(i).padStart(4, '0')}.jpg\n${start.toFixed(3)}`);
  }

  await writeFile(path.join(outputDir, 'sprite.vtt'), spriteContent.join('\n\n'), 'utf-8');
}
