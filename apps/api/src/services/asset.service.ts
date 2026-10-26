import { Queue } from 'bullmq';
import { S3Service } from './s3.service.js';

export class AssetService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly transcodeQueue: Queue
  ) {}

  /**
   * Encola la transcodificación de un asset.
   * Devuelve el id del job, o `null` si ya existe un job activo/esperando
   * para el mismo asset (deduplicated con jobId = assetId).
   */
  async enqueueTranscodeJob(assetId: string, userId: string, inputKey: string): Promise<string | null> {
    const existing = await this.transcodeQueue.getJob(assetId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        return null;
      }
      // Un job previo (completed/failed) conservado por removeOnComplete/removeOnFail
      // impediría re-encolar con el mismo jobId en BullMQ v5: lo removemos primero.
      try {
        await existing.remove();
      } catch {
        // El job ya no existe: nada que limpiar.
      }
    }

    const job = await this.transcodeQueue.add(
      'transcode',
      { assetId, userId, inputKey },
      {
        // jobId = assetId: dedupe nativo de BullMQ y trazabilidad directa.
        jobId: assetId,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 }
      }
    );

    return job.id || assetId;
  }

  generatePlaybackId(): string {
    return `playback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async generatePlaybackUrl(
    s3Service: S3Service,
    playbackId: string
  ): Promise<string> {
    return s3Service.getPublicUrl(`hls/${playbackId}/master.m3u8`);
  }
}
