import { Queue, Worker, JobState } from 'bullmq';
import postgres from 'postgres';
import { VIDEO_QUEUE_NAME, computeWorkerConfig, TranscodeJobData } from './types';
import { transcodeProcessor } from './processors/transcode.processor';

/** Marca un asset como failed solo si sigue en 'processing' (idempotente). */
async function markAssetFailed(assetId: string): Promise<void> {
  try {
    const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
    await sql`UPDATE assets SET status = 'failed', updated_at = NOW() WHERE id = ${assetId} AND status = 'processing'`;
    await sql.end();
  } catch (error) {
    console.warn(`[Worker] No se pudo marcar como failed el asset ${assetId}:`, (error as Error).message);
  }
}

/**
 * Al arrancar, marca como failed los assets que están en 'processing' pero no
 * tienen ningún job activo/esperando en Redis (crash del worker o stalled jobs).
 */
async function reconcileOrphanProcessing(queue: Queue): Promise<void> {
  try {
    const states: JobState[] = ['active', 'waiting', 'delayed', 'prioritized'];
    const jobs = await queue.getJobs(states);
    const busyIds = new Set(
      jobs.map((job) => (job?.data as TranscodeJobData | undefined)?.assetId).filter(Boolean)
    );

    // Ventana de gracia: un job recién encolado puede tardar en aparecer en el
    // snapshot de Redis; un asset con updated_at reciente no se toca.
    const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
    const stuck = await sql`SELECT id FROM assets WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'`;
    const orphans = stuck.map((row) => row.id as string).filter((id) => !busyIds.has(id));

    if (orphans.length > 0) {
      await sql`UPDATE assets SET status = 'failed', updated_at = NOW() WHERE id IN ${sql(orphans)}`;
      console.log(`[Worker] Reconciliación: ${orphans.length} asset(s) huérfanos marcados como failed`);
    } else {
      console.log('[Worker] Reconciliación: sin assets huérfanos');
    }
    await sql.end();
  } catch (error) {
    console.warn('[Worker] Reconciliación fallida:', (error as Error).message);
  }
}

async function loadStartupSettings(): Promise<{ concurrency?: number; ffmpeg_threads?: number }> {
  // La tabla `settings` la crea la API (drizzle push) al arrancar; reintentamos
  // por si el worker inicia antes de que exista.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
      const rows = await sql`SELECT concurrency, ffmpeg_threads FROM settings LIMIT 1`;
      await sql.end();
      return (rows[0] ?? {}) as { concurrency?: number; ffmpeg_threads?: number };
    } catch (error) {
      if (attempt === 19) {
        console.warn('[Worker] No se pudieron leer ajustes de la DB:', (error as Error).message);
        return {};
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  return {};
}

const workerConfig = computeWorkerConfig();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('[Worker] Starting StreamFlow worker...');
  console.log('[Worker] Redis:', redisUrl);
  console.log('[Worker] Concurrency:', workerConfig.concurrency);
  console.log('[Worker] FFmpeg threads:', workerConfig.ffmpegThreads);

  const settings = await loadStartupSettings();
  const concurrency = Number(settings.concurrency) > 0 ? Number(settings.concurrency) : workerConfig.concurrency;
  console.log('[Worker] Concurrency (efectiva):', concurrency);

  // Reconciliación ANTES de crear el Worker: así no compite con jobs que este
  // mismo worker pueda levantar durante la verificación de huérfanos.
  const scanQueue = new Queue(VIDEO_QUEUE_NAME, { connection: { url: redisUrl } });
  await reconcileOrphanProcessing(scanQueue);
  await scanQueue.close();

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
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    // Cubre timeouts y paths que no pasaron por el catch del procesador.
    // El catch normal del procesador ya marca 'failed' antes de relanzar;
    // por eso el UPDATE es condicional (solo si sigue en 'processing').
    const assetId = (job?.data as TranscodeJobData | undefined)?.assetId;
    if (assetId) {
      void markAssetFailed(assetId);
    }
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