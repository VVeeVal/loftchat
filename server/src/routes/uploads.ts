import { FastifyInstance } from 'fastify';
import { requireOrganization } from '../organization-middleware.js';
import { BadRequestError } from '../errors/app-errors.js';
import { config } from '../config/index.js';
import { prisma } from '../db.js';
import { storageAdapter, isAllowedMimeType, cleanFilename } from '../utils/storage.js';
import { AuthenticatedRequest } from '../types/request.js';

const getStorageUsage = async (organizationId: string, userId: string) => {
  const [orgUsage, userUsage] = await Promise.all([
    prisma.upload.aggregate({
      where: { organizationId },
      _sum: { size: true }
    }),
    prisma.upload.aggregate({
      where: { organizationId, userId },
      _sum: { size: true }
    })
  ]);

  return {
    orgUsedBytes: orgUsage._sum.size ?? 0,
    userUsedBytes: userUsage._sum.size ?? 0
  };
};

export default async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);
  // Upload File
  app.post('/upload', async (req, res) => {
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestError('No file');
    }

    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const safeFilename = cleanFilename(data.filename || 'upload');

    if (!isAllowedMimeType(data.mimetype)) {
      data.file.resume();
      throw new BadRequestError('Unsupported file type');
    }

    const { url, key, size } = await storageAdapter.save({
      stream: data.file,
      filename: safeFilename,
      mimetype: data.mimetype
    });

    if (data.file.truncated) {
      await storageAdapter.remove(key);
      throw new BadRequestError(`File exceeds max size of ${config.maxUploadSizeBytes} bytes`);
    }

    if (size > config.maxUploadSizeBytes) {
      await storageAdapter.remove(key);
      throw new BadRequestError(`File exceeds max size of ${config.maxUploadSizeBytes} bytes`);
    }

    const { orgUsedBytes, userUsedBytes } = await getStorageUsage(orgContext.organizationId, user.id);
    const nextOrgUsage = orgUsedBytes + size;
    const nextUserUsage = userUsedBytes + size;

    if (config.orgStorageQuotaBytes > 0 && nextOrgUsage > config.orgStorageQuotaBytes) {
      await storageAdapter.remove(key);
      throw new BadRequestError('Organization storage quota exceeded');
    }

    if (config.userStorageQuotaBytes > 0 && nextUserUsage > config.userStorageQuotaBytes) {
      await storageAdapter.remove(key);
      throw new BadRequestError('User storage quota exceeded');
    }

    const upload = await prisma.upload.create({
      data: {
        organizationId: orgContext.organizationId,
        userId: user.id,
        storageKey: key,
        url,
        filename: safeFilename,
        mimetype: data.mimetype,
        size
      }
    });

    return {
      id: upload.id,
      uploadId: upload.id,
      url: upload.url,
      filename: upload.filename,
      mimetype: upload.mimetype,
      size: upload.size
    };
  });
}
