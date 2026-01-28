import { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { randomBytes } from 'crypto';
import { requireOrganizationAdmin } from './organization-middleware.js';
import { AuthenticatedRequest } from './types/request.js';
import { validateBody } from './plugins/validator.js';
import { createRegistrationLinkSchema } from './schemas/registration.schemas.js';
import { config } from './config/index.js';

export default async function registrationLinksRoutes(app: FastifyInstance) {
  // Add hook to require organization context and admin role
  app.addHook('preHandler', requireOrganizationAdmin);

  // Create registration link
  app.post<{ Body: { expiresInHours?: number; usageLimit?: number; allowUnlimited?: boolean } }>('/registration-links', {
    preHandler: [validateBody(createRegistrationLinkSchema)]
  }, async (req, res) => {
    const { expiresInHours, usageLimit, allowUnlimited } = req.body || {};
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    // Generate secure token
    const token = randomBytes(32).toString('hex');

    // Calculate expiration date if provided
    let expiresAt: Date | null = null;
    if (expiresInHours && expiresInHours > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    }

    const resolvedUsageLimit = allowUnlimited ? null : (usageLimit ?? 1);

    const link = await prisma.registrationLink.create({
      data: {
        token,
        expiresAt,
        createdBy: user.id,
        organizationId: orgContext.organizationId,
        usageLimit: resolvedUsageLimit
      }
    });

    // Get base URL for the registration link (should point to frontend)
    const baseUrl = config.frontendUrl;
    const registrationUrl = `${baseUrl}/register?token=${token}`;

    return {
      id: link.id,
      token: link.token,
      registrationUrl,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      isUsed: link.isUsed,
      usageLimit: link.usageLimit,
      usageCount: link.usageCount
    };
  });

  // List registration links
  app.get('/registration-links', async (req, res) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const links = await prisma.registrationLink.findMany({
      where: { organizationId: orgContext.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const baseUrl = config.frontendUrl;

    return links.map(link => ({
      id: link.id,
      token: link.token,
      registrationUrl: `${baseUrl}/register?token=${link.token}`,
      isUsed: link.isUsed,
      usageLimit: link.usageLimit,
      usageCount: link.usageCount,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      creator: link.creator
    }));
  });
}
