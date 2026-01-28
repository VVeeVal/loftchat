import { FastifyInstance } from 'fastify';
import { requireOrganization } from '../organization-middleware.js';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { config } from '../config/index.js';

export default async function storageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  app.get('/storage/info', async (req) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const [orgUsage, userUsage] = await Promise.all([
      prisma.upload.aggregate({
        where: { organizationId: orgContext.organizationId },
        _sum: { size: true }
      }),
      prisma.upload.aggregate({
        where: { organizationId: orgContext.organizationId, userId: user.id },
        _sum: { size: true }
      })
    ]);

    return {
      storageBackend: config.storageBackend,
      maxUploadSizeBytes: config.maxUploadSizeBytes,
      orgQuotaBytes: config.orgStorageQuotaBytes,
      userQuotaBytes: config.userStorageQuotaBytes,
      orgUsedBytes: orgUsage._sum.size ?? 0,
      userUsedBytes: userUsage._sum.size ?? 0
    };
  });
}
