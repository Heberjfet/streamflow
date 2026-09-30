import os from 'os';

export interface RenditionProfile {
  quality: string;
  width: number;
  height: number;
  bitrateKbps: number;
  profile: string;
  level: string;
  codecTag: string;
}

export interface TranscodeJobData {
  assetId: string;
  userId?: string;
  inputKey: string;
  outputKey?: string;
  thumbnailKey?: string;
  renditions?: RenditionProfile[];
}

export interface JobResult {
  success: boolean;
  assetId: string;
  outputKeys?: string[];
  error?: string;
}

export interface AssetStatus {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  outputKey?: string;
  error?: string;
}

export interface WorkerConfig {
  concurrency: number;
  ffmpegThreads: number;
  cpuCores: number;
  totalMemGB: number;
}

export const RENDITIONS: RenditionProfile[] = [
  { quality: '360p',  width: 640,  height: 360,  bitrateKbps: 1000,  profile: 'main', level: '3.0', codecTag: 'avc1.4d401e' },
  { quality: '480p',  width: 854,  height: 480,  bitrateKbps: 1800,  profile: 'main', level: '3.0', codecTag: 'avc1.4d401e' },
  { quality: '720p',  width: 1280, height: 720,  bitrateKbps: 3000,  profile: 'main', level: '3.1', codecTag: 'avc1.4d401f' },
  { quality: '1080p', width: 1920, height: 1080, bitrateKbps: 6000,  profile: 'high', level: '4.0', codecTag: 'avc1.640028' },
];

export const VIDEO_QUEUE_NAME = 'video-processing';
export const JOB_TYPES = {
  TRANSCODE: 'transcode',
} as const;

export function computeWorkerConfig(): WorkerConfig {
  const cpuCores = os.cpus().length;
  const totalMemGB = os.totalmem() / (1024 ** 3);
  const availableMemGB = Math.max(1, totalMemGB - 1);

  const MEM_PER_JOB_GB = 1.5;
  const idealThreadsPerJob = Math.min(4, cpuCores);

  const memBasedConcurrency = Math.floor(availableMemGB / MEM_PER_JOB_GB);
  const cpuBasedConcurrency = Math.floor(cpuCores / idealThreadsPerJob);

  const concurrency = process.env.WORKER_CONCURRENCY
    ? parseInt(process.env.WORKER_CONCURRENCY, 10)
    : Math.max(1, Math.min(memBasedConcurrency, cpuBasedConcurrency));
  const ffmpegThreads = process.env.FFMPEG_THREADS
    ? parseInt(process.env.FFMPEG_THREADS, 10)
    : Math.max(1, Math.floor(cpuCores / concurrency));

  return { concurrency, ffmpegThreads, cpuCores, totalMemGB };
}