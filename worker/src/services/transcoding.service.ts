import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { runFfmpeg } from './ffmpeg.service.js';

export interface RenditionProfile {
  quality: string;
  width: number;
  height: number;
  bitrateKbps: number;
  codec?: 'h264' | 'h265';
}

// Escalera por defecto si no hay ajustes en la base de datos.
export const DEFAULT_LADDER: RenditionProfile[] = [
  { quality: '360p', width: 640, height: 360, bitrateKbps: 1000, codec: 'h264' },
  { quality: '480p', width: 854, height: 480, bitrateKbps: 1800, codec: 'h264' },
  { quality: '720p', width: 1280, height: 720, bitrateKbps: 3000, codec: 'h264' },
  { quality: '1080p', width: 1920, height: 1080, bitrateKbps: 6000, codec: 'h264' },
];

/** Filtra la escalera a calidades que no superen la resolución del origen (sin upscaling). */
export function buildLadder(profiles: RenditionProfile[], sourceWidth: number, sourceHeight: number): RenditionProfile[] {
  const shortSide = Math.min(sourceWidth, sourceHeight);
  const filtered = profiles
    .filter(p => p.height <= shortSide)
    .sort((a, b) => a.height - b.height);

  if (filtered.length > 0) return filtered;

  const smallest = [...profiles].sort((a, b) => a.height - b.height)[0];
  return smallest ? [smallest] : [];
}

function codecTagFor(profile: RenditionProfile): string {
  if (profile.codec === 'h265') return 'hvc1.1.6.L120.B0';
  return profile.height >= 1080 ? 'avc1.640028' : 'avc1.4d401f';
}

export async function transcodeRendition(
  sourcePath: string,
  outputDir: string,
  profile: RenditionProfile,
  durationSec?: number,
  threads?: number,
  encoder: string = 'libx264',
): Promise<void> {
  const renditionDir = path.join(outputDir, profile.quality);
  await mkdir(renditionDir, { recursive: true });

  const timeoutMs = durationSec
    ? Math.max(10 * 60_000, durationSec * 4_000)
    : undefined;

  const isX264 = encoder === 'libx264';
  const isX265 = encoder === 'libx265';

  await runFfmpeg([
    '-y',
    ...(threads ? ['-threads', String(threads)] : []),
    '-i', sourcePath,
    '-vf', `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v', encoder,
    ...(isX264 ? ['-preset', 'fast', '-crf', '23', '-profile:v', 'main', '-level', '4.0'] : []),
    ...(isX265 ? ['-preset', 'fast', '-crf', '28'] : []),
    '-maxrate', `${profile.bitrateKbps}k`,
    '-bufsize', `${profile.bitrateKbps * 2}k`,
    '-g', '48',
    '-keyint_min', '48',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', path.join(renditionDir, 'segment_%03d.ts'),
    path.join(renditionDir, 'index.m3u8'),
  ], timeoutMs);
}

export async function extractPosterThumbnail(
  sourcePath: string,
  outputDir: string,
  durationSec: number,
): Promise<void> {
  const posterTime = Math.max(0, Math.floor(durationSec * 0.25));
  await runFfmpeg([
    '-y',
    '-ss', String(posterTime),
    '-i', sourcePath,
    '-vframes', '1',
    '-vf', 'scale=640:-2',
    '-q:v', '2',
    path.join(outputDir, 'thumbnail.jpg'),
  ]);
}

export async function createDownloadableMp4(
  outputDir: string,
  profile: RenditionProfile,
): Promise<void> {
  const renditionDir = path.join(outputDir, profile.quality);
  const playlistPath = path.join(renditionDir, 'index.m3u8');

  await runFfmpeg([
    '-y',
    '-i', playlistPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    path.join(renditionDir, 'download.mp4'),
  ]);
}

export async function createMasterPlaylist(
  outputDir: string,
  profiles: RenditionProfile[],
): Promise<void> {
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const profile of profiles) {
    const audio = profile.codec === 'h265' ? 'mp4a.40.2' : 'mp4a.40.2';
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${profile.bitrateKbps * 1000},RESOLUTION=${profile.width}x${profile.height},CODECS="${codecTagFor(profile)},${audio}"\n`;
    content += `${profile.quality}/index.m3u8\n`;
  }
  await writeFile(path.join(outputDir, 'master.m3u8'), content, 'utf-8');
}
