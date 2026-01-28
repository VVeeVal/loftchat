import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { BadRequestError, InternalServerError } from '../errors/app-errors.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

type StorageSaveParams = {
  stream: NodeJS.ReadableStream;
  filename: string;
  mimetype?: string;
};

type StorageSaveResult = {
  url: string;
  key: string;
  size: number;
};

export type StorageAdapter = {
  save: (params: StorageSaveParams) => Promise<StorageSaveResult>;
  remove: (key: string) => Promise<void>;
};

export const isAllowedMimeType = (mimetype?: string) => {
  if (!mimetype) return false;
  return config.allowedUploadMimeTypes.some((allowed) => {
    if (allowed.endsWith('/*')) {
      const prefix = allowed.slice(0, allowed.length - 1);
      return mimetype.startsWith(prefix);
    }
    return mimetype === allowed;
  });
};

const sanitizeFilename = (filename: string) => {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
};

export const cleanFilename = sanitizeFilename;

const buildStorageKey = (filename: string) => {
  const safe = sanitizeFilename(filename);
  return `${Date.now()}-${crypto.randomUUID()}-${safe}`;
};

const buildPublicUrl = (key: string) => {
  if (config.storageBackend === 'local') {
    return `/uploads/${key}`;
  }

  if (config.storagePublicUrl) {
    return `${config.storagePublicUrl.replace(/\/$/, '')}/${key}`;
  }

  if (config.storageEndpoint) {
    const endpoint = config.storageEndpoint.replace(/\/$/, '');
    if (config.storageForcePathStyle || config.storageBackend === 'minio') {
      return `${endpoint}/${config.storageBucket}/${key}`;
    }
    return `${endpoint}/${key}`;
  }

  if (config.storageBucket && config.storageRegion) {
    return `https://${config.storageBucket}.s3.${config.storageRegion}.amazonaws.com/${key}`;
  }

  throw new InternalServerError('Storage public URL is not configured');
};

const createS3Client = () => {
  if (!config.storageBucket || !config.storageAccessKeyId || !config.storageSecretAccessKey) {
    throw new BadRequestError('S3 storage is not configured');
  }

  return new S3Client({
    region: config.storageRegion || 'us-east-1',
    credentials: {
      accessKeyId: config.storageAccessKeyId,
      secretAccessKey: config.storageSecretAccessKey
    },
    endpoint: config.storageEndpoint,
    forcePathStyle: config.storageForcePathStyle || config.storageBackend === 'minio'
  });
};

const localAdapter: StorageAdapter = {
  save: async ({ stream, filename, mimetype }) => {
    const key = buildStorageKey(filename);
    const uploadDir = path.join(process.cwd(), config.uploadDir);
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const uploadPath = path.join(uploadDir, key);
    const writer = fs.createWriteStream(uploadPath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writer);
      writer.on('finish', () => resolve());
      writer.on('error', (err) => reject(err));
      stream.on('error', (err) => reject(err));
    });

    const stats = await fs.promises.stat(uploadPath);

    return {
      url: buildPublicUrl(key),
      key,
      size: stats.size
    };
  },
  remove: async (key: string) => {
    const uploadPath = path.join(process.cwd(), config.uploadDir, key);
    await fs.promises.unlink(uploadPath).catch(() => undefined);
  }
};

const s3Adapter: StorageAdapter = {
  save: async ({ stream, filename, mimetype }) => {
    const client = createS3Client();
    const key = buildStorageKey(filename);
    const passThrough = new PassThrough();
    let size = 0;

    passThrough.on('data', (chunk) => {
      size += chunk.length;
    });

    stream.pipe(passThrough);

    await client.send(new PutObjectCommand({
      Bucket: config.storageBucket,
      Key: key,
      Body: passThrough,
      ContentType: mimetype
    }));

    return {
      url: buildPublicUrl(key),
      key,
      size
    };
  },
  remove: async (key: string) => {
    const client = createS3Client();
    await client.send(new DeleteObjectCommand({
      Bucket: config.storageBucket,
      Key: key
    }));
  }
};

export const storageAdapter: StorageAdapter = config.storageBackend === 'local'
  ? localAdapter
  : s3Adapter;
