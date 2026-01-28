import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),
  ALLOWED_UPLOAD_MIME_TYPES: z.string().optional(),
  STORAGE_BACKEND: z.enum(['local', 's3', 'minio']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_PUBLIC_URL: z.string().url().optional(),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().optional(),
  ORG_STORAGE_QUOTA_MB: z.coerce.number().int().nonnegative().default(0),
  USER_STORAGE_QUOTA_MB: z.coerce.number().int().nonnegative().default(0),
  ORPHAN_UPLOAD_TTL_HOURS: z.coerce.number().int().positive().default(24)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const data = parsed.data;
const frontendUrl = data.FRONTEND_URL
  ?? (data.NODE_ENV === 'production' ? undefined : 'http://localhost:5173');

if (!frontendUrl) {
  throw new Error('FRONTEND_URL is required in production.');
}

export const config = {
  nodeEnv: data.NODE_ENV,
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  betterAuthSecret: data.BETTER_AUTH_SECRET,
  betterAuthUrl: data.BETTER_AUTH_URL,
  frontendUrl,
  uploadDir: data.UPLOAD_DIR,
  maxUploadSizeBytes: data.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  allowedUploadMimeTypes: data.ALLOWED_UPLOAD_MIME_TYPES
    ? data.ALLOWED_UPLOAD_MIME_TYPES.split(',').map((entry) => entry.trim()).filter(Boolean)
    : [
        'image/*',
        'application/pdf',
        'text/plain',
        'application/json',
        'application/zip'
      ],
  storageBackend: data.STORAGE_BACKEND,
  storageBucket: data.STORAGE_BUCKET,
  storageRegion: data.STORAGE_REGION,
  storageAccessKeyId: data.STORAGE_ACCESS_KEY_ID,
  storageSecretAccessKey: data.STORAGE_SECRET_ACCESS_KEY,
  storageEndpoint: data.STORAGE_ENDPOINT,
  storagePublicUrl: data.STORAGE_PUBLIC_URL,
  storageForcePathStyle: data.STORAGE_FORCE_PATH_STYLE ?? false,
  orgStorageQuotaBytes: data.ORG_STORAGE_QUOTA_MB * 1024 * 1024,
  userStorageQuotaBytes: data.USER_STORAGE_QUOTA_MB * 1024 * 1024,
  orphanUploadTtlMs: data.ORPHAN_UPLOAD_TTL_HOURS * 60 * 60 * 1000,
  isProduction: data.NODE_ENV === 'production'
};
