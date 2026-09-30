import { Queue, QueueEvents } from 'bullmq';
import { VIDEO_QUEUE_NAME, JOB_TYPES } from '../types';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const videoQueue = new Queue(VIDEO_QUEUE_NAME, {
  connection: { url: redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const queueEvents = new QueueEvents(VIDEO_QUEUE_NAME, {
  connection: { url: redisUrl },
});

export async function addTranscodeJob(data: {
  assetId: string;
  sourceKey: string;
  renditions: any[];
}) {
  return videoQueue.add(JOB_TYPES.TRANSCODE, data, {
    jobId: `transcode-${data.assetId}`,
  });
}

export async function closeQueue() {
  await videoQueue.close();
  await queueEvents.close();
}