import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Config } from '../types/index.js';

const s3Config: S3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'streamflow',
  accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  publicUrl: process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || 'http://localhost:9000'
};

// Endpoint interno (API -> MinIO dentro de la red Docker).
const s3Client = new S3Client({
  endpoint: s3Config.endpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey
  },
  forcePathStyle: true
});

// Endpoint público (navegador -> MinIO). Las URLs firmadas deben generarse con
// este host para que la firma coincida con lo que envía el navegador.
const browserEndpoint =
  process.env.S3_BROWSER_ENDPOINT ||
  process.env.S3_PUBLIC_URL ||
  process.env.S3_ENDPOINT ||
  'http://localhost:9000';

const s3PublicClient = new S3Client({
  endpoint: browserEndpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey
  },
  forcePathStyle: true
});

export default fp(async function s3Plugin(fastify: FastifyInstance) {
  fastify.decorate('s3', s3Client);
  fastify.decorate('s3Config', s3Config);

  fastify.decorate('generateUploadUrl', async (key: string, contentType: string) => {
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      ContentType: contentType
    });
    const url = await getSignedUrl(s3PublicClient, command, { expiresIn: 3600 });
    // MinIO no acepta los parámetros de checksum que agrega el SDK de AWS.
    const urlObj = new URL(url);
    urlObj.searchParams.delete('x-amz-checksum-crc32');
    urlObj.searchParams.delete('x-amz-sdk-checksum-algorithm');
    return urlObj.toString();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    s3: S3Client;
    s3Config: S3Config;
    generateUploadUrl: (key: string, contentType: string) => Promise<string>;
  }
}

export { s3Client, s3Config };
