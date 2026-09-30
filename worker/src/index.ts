import { Worker } from 'bullmq';
import { VIDEO_QUEUE_NAME, computeWorkerConfig } from './types';
import { transcodeProcessor } from './processors/transcode.processor';

const workerConfig = computeWorkerConfig();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('[Worker] Starting StreamFlow v2 worker...');
  console.log('[Worker] Redis:', redisUrl);
  console.log('[Worker] Concurrency:', workerConfig.concurrency);
  console.log('[Worker] FFmpeg threads:', workerConfig.ffmpegThreads);

  const worker = new Worker(
    VIDEO_QUEUE_NAME,
    async (job) => {
      console.log(`[Worker] Processing job ${job.id} (${job.name})`);

      if (job.name === 'transcode') {
        return transcodeProcessor({
          data: job.data,
          updateProgress: (p) => job.updateProgress(p),
        });
      }
      throw new Error(`Unknown job type: ${job.name}`);
    },
    {
      connection: { url: redisUrl },
      concurrency: workerConfig.concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log('[Worker] Ready and waiting for jobs...');

  process.on('SIGTERM', async () => {
    console.log('[Worker] Received SIGTERM, shutting down...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Worker] Received SIGINT, shutting down...');
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});