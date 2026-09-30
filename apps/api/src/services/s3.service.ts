import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Config } from '../types/index.js';

export class S3Service {
  constructor(
    private readonly s3: S3Client,
    private readonly config: S3Config
  ) {}

  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicUrl}/${this.config.bucket}/${key}`;
  }

  getAssetPath(userId: string, assetId: string, filename: string): string {
    return `uploads/${userId}/${assetId}/${filename}`;
  }

  getHlsPath(assetId: string): string {
    return `hls/${assetId}/master.m3u8`;
  }

  getThumbnailPath(assetId: string): string {
    return `thumbnails/${assetId}/thumb.jpg`;
  }

  /** Borra todos los objetos que empiezan con un prefijo (paginado). */
  async deletePrefix(prefix: string): Promise<number> {
    let continuationToken: string | undefined;
    let deleted = 0;

    do {
      const listed = await this.s3.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      }));

      const objects = (listed.Contents || [])
        .map(obj => obj.Key)
        .filter((key): key is string => Boolean(key))
        .map(key => ({ Key: key }));

      if (objects.length > 0) {
        await this.s3.send(new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Objects: objects }
        }));
        deleted += objects.length;
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    return deleted;
  }
}
