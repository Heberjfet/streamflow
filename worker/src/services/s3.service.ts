import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

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
      const body = response.Body as any;
      if (body.transformToWriteStream) {
        const writeStream = createWriteStream(localPath);
        await pipeline(await body.transformToWriteStream(), writeStream);
      } else {
        await fs.writeFile(localPath, body);
      }
    }
    console.log(`[S3] Download complete: ${localPath}`);
  }

  async uploadFile(
    key: string,
    localPath: string,
    contentType: string = 'application/octet-stream'
  ): Promise<void> {
    console.log(`[S3] Uploading ${localPath} to s3://${this.bucket}/${key}`);
    const fileBuffer = await fs.readFile(localPath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.client.send(command);
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
      } else {
        const contentType = file.name.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : file.name.endsWith('.vtt')
          ? 'text/vtt'
          : 'video/mp2t';
        await this.uploadFile(s3Key, localPath, contentType);
        uploadedKeys.push(s3Key);
      }
    }

    return uploadedKeys;
  }

  async deleteFolder(prefix: string): Promise<void> {
    console.log(`[S3] Deleting folder s3://${this.bucket}/${prefix}`);
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: [{ Key: prefix }] },
    });
    await this.client.send(command);
  }
}

export const s3Service = new S3Service();