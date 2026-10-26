import {
  S3Client,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.vtt': 'text/vtt',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.ts': 'video/mp2t',
  '.webm': 'video/webm',
};

function contentTypeFor(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  return CONTENT_TYPES[fileName.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET || 'streamflow';
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    console.log(`[S3] Downloading s3://${this.bucket}/${key} to ${localPath}`);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);

    const dirname = path.dirname(localPath);
    await fs.mkdir(dirname, { recursive: true });

    if (response.Body) {
      await pipeline(response.Body as Readable, createWriteStream(localPath));
    }
    console.log(`[S3] Download complete: ${localPath}`);
  }

  async uploadFile(
    key: string,
    localPath: string,
    contentType: string = 'application/octet-stream'
  ): Promise<void> {
    console.log(`[S3] Uploading ${localPath} to s3://${this.bucket}/${key}`);
    // Subida en streaming: no carga el archivo completo en memoria.
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
      },
    });

    await upload.done();
    console.log(`[S3] Upload complete: ${key}`);
  }

  async uploadFolder(localFolder: string, s3Prefix: string): Promise<string[]> {
    console.log(`[S3] Uploading folder ${localFolder} to ${s3Prefix}`);
    const uploadedKeys: string[] = [];
    const files = await fs.readdir(localFolder, { withFileTypes: true });

    for (const file of files) {
      const localPath = path.join(localFolder, file.name);
      const s3Key = `${s3Prefix}/${file.name}`;

      if (file.isDirectory()) {
        const subKeys = await this.uploadFolder(localPath, s3Key);
        uploadedKeys.push(...subKeys);
      } else if (file.name === 'download.mp4') {
        // Los MP4 descargables se suben aparte: fuera del prefijo HLS público
        // para que la lectura anónima no eluya el flag allowDownload.
        continue;
      } else {
        await this.uploadFile(s3Key, localPath, contentTypeFor(file.name));
        uploadedKeys.push(s3Key);
      }
    }

    return uploadedKeys;
  }

  /** Borra todos los objetos que empiezan con un prefijo (listado paginado por lotes). */
  async deleteFolder(prefix: string): Promise<void> {
    console.log(`[S3] Deleting folder s3://${this.bucket}/${prefix}`);
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));

      const objects = (listed.Contents || []).map(obj => ({ Key: obj.Key! })).filter(o => Boolean(o.Key));
      if (objects.length > 0) {
        await this.client.send(new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects },
        }));
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

export const s3Service = new S3Service();