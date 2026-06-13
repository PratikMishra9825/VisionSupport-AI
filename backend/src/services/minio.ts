import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import { encryptBuffer, decryptBuffer } from './security';

let minioClient: Minio.Client | null = null;
let isMinioAvailable = false;

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const initMinio = async () => {
  const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = Number(process.env.MINIO_PORT) || 9000;
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

  try {
    minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });
    
    // Check connection by listing buckets (or trying to ping)
    await minioClient.listBuckets();
    isMinioAvailable = true;
    console.log('MinIO Object Storage connected successfully.');
  } catch (error) {
    console.warn('MinIO Object Storage is unavailable. Falling back to local disk storage in ./uploads');
    minioClient = null;
    isMinioAvailable = false;
  }
};

// Upload file (with automatic AES encryption)
export const uploadObject = async (bucket: string, objectName: string, buffer: Buffer): Promise<string> => {
  // Encrypt the buffer before writing
  const encryptedBuffer = encryptBuffer(buffer);

  if (isMinioAvailable && minioClient) {
    try {
      await minioClient.putObject(bucket, objectName, encryptedBuffer);
      return `minio://${bucket}/${objectName}`;
    } catch (error) {
      console.error(`MinIO upload failed for ${objectName}:`, error);
      // Fallback to local disk if MinIO upload fails at runtime
    }
  }

  // Fallback: local filesystem
  const localPath = path.join(UPLOADS_DIR, bucket, objectName);
  const localDir = path.dirname(localPath);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  
  await fs.promises.writeFile(localPath, encryptedBuffer);
  return `local://${bucket}/${objectName}`;
};

// Download file (with automatic AES decryption)
export const downloadObject = async (bucket: string, objectName: string): Promise<Buffer> => {
  let encryptedBuffer: Buffer;

  if (isMinioAvailable && minioClient) {
    try {
      const stream = await minioClient.getObject(bucket, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      encryptedBuffer = Buffer.concat(chunks);
    } catch (error) {
      console.error(`MinIO download failed for ${objectName}:`, error);
      // Try local filesystem fallback
      const localPath = path.join(UPLOADS_DIR, bucket, objectName);
      encryptedBuffer = await fs.promises.readFile(localPath);
    }
  } else {
    // Local filesystem download
    const localPath = path.join(UPLOADS_DIR, bucket, objectName);
    encryptedBuffer = await fs.promises.readFile(localPath);
  }

  // Decrypt and return
  return decryptBuffer(encryptedBuffer);
};

// Get secure signed URL for accessing objects
export const getSignedDownloadUrl = async (bucket: string, objectName: string): Promise<string> => {
  if (isMinioAvailable && minioClient) {
    try {
      // Generate signed URL with 24 hours expiry (86400 seconds)
      const url = await minioClient.presignedGetObject(bucket, objectName, 86400);
      return url;
    } catch (error) {
      console.error(`Presigned URL generation failed for ${objectName}:`, error);
    }
  }

  // Fallback to local server routing endpoint (which handles decryption and download)
  const apiHost = process.env.API_URL || '';
  return `${apiHost}/api/files/download/local/${bucket}/${objectName}`;
};

// Initialize connection async on start
initMinio();
