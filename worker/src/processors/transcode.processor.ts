import { rm, mkdir, writeFile, stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { TranscodeJobData, computeWorkerConfig } from '../types';
import { ffprobe, runFfmpeg } from '../services/ffmpeg.service';
import { s3Service } from '../services/s3.service';
import {
  filterLadder,
  transcodeRendition,
  createDownloadableMp4,
  extractPosterThumbnail,
  createMasterPlaylist,
} from '../services/transcoding.service';
import postgres from 'postgres';

const MAX_ERROR_MESSAGE_LENGTH = 200;

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unknown worker error';
  return raw.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

async function updateAssetStatus(
  assetId: string,
  status: 'pending' | 'processing' | 'ready' | 'failed',
  outputKey?: string,
  thumbnailKey?: string
) {
  const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const query = `
    UPDATE assets
    SET status = $1, hls_manifest_key = $2, thumbnail_key = $3, updated_at = NOW()
    WHERE id = $4
  `;
  await sql.unsafe(query, [status, outputKey ?? null, thumbnailKey ?? null, assetId]);
  await sql.end();
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

  const tmpDir = path.join(os.tmpdir(), `streamflow-${randomUUID()}`);
  let sourcePath = path.join(tmpDir, 'source.mp4');
  const outputDir = path.join(tmpDir, 'hls');
  await mkdir(outputDir, { recursive: true });

  try {
    await updateAssetStatus(assetId, 'processing');

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

    const ladder = filterLadder(probe.width, probe.height);
    console.log(`[Transcode] Ladder: ${ladder.map(p => p.quality).join(', ')}`);

    let completedSteps = 10;
    const stepSize = 70 / ladder.length;

    for (const profile of ladder) {
      console.log(`[Transcode] Transcoding ${profile.quality}...`);
      await transcodeRendition(sourcePath, outputDir, profile, probe.duration, workerConfig.ffmpegThreads);

      await createDownloadableMp4(outputDir, profile);

      completedSteps += stepSize;
      await job.updateProgress(Math.min(completedSteps, 80));
    }

    console.log('[Transcode] Generating thumbnails...');
    await generateThumbnails(sourcePath, outputDir, probe.duration);
    await extractPosterThumbnail(sourcePath, outputDir, probe.duration);
    await job.updateProgress(85);

    console.log('[Transcode] Creating master playlist...');
    await createMasterPlaylist(outputDir, ladder);
    await job.updateProgress(90);

    console.log('[Transcode] Uploading to S3...');
    await s3Service.uploadFolder(outputDir, `assets/${assetId}/hls`);

    const masterKey = `assets/${assetId}/hls/master.m3u8`;
    const thumbnailKey = `assets/${assetId}/hls/thumbnail.jpg`;

    await updateAssetStatus(assetId, 'ready', masterKey, thumbnailKey);
    await job.updateProgress(100);

    console.log(`[Transcode] Job completed for asset: ${assetId}`);

  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);
    console.error(`[Transcode] Job failed for asset ${assetId}:`, errorMessage);
    await updateAssetStatus(assetId, 'failed');
    throw error;
  } finally {
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