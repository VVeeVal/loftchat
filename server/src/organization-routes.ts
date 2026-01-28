import { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { requireAuthSession, requireOrganization, requireOrganizationAdmin } from './organization-middleware.js';
import { validateBody, validateParams } from './plugins/validator.js';
import { idParamSchema } from './schemas/common.schemas.js';
import { createOrganizationSchema, switchOrganizationSchema, updateOrganizationSchema } from './schemas/organization.schemas.js';
import { AuthenticatedRequest } from './types/request.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from './errors/app-errors.js';

export default async function organizationRoutes(app: FastifyInstance) {
  // Middleware: Apply organization middleware to all routes
  app.addHook('preHandler', async (req, res) => {
    // Skip for health check
    if (req.url === '/api/health') return;

    if (req.url === '/api/organizations' && (req.method === 'GET' || req.method === 'POST')) {
      await requireAuthSession(req, res);
      return;
    }

    await requireOrganization(req, res);
  });

  // GET /organizations - List user's organizations
  app.get('/organizations', async (req) => {
    const userId = (req as AuthenticatedRequest).user.id;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      organizations: memberships.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        description: m.organization.description,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  });

  // GET /organizations/current - Get current organization details
  app.get('/organizations/current', async (req) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext;

    const org = await prisma.organization.findUnique({
      where: { id: orgContext.organizationId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      description: org.description,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      members: org.members.map(m => ({
        id: m.id,
        userId: m.user.id,
        userName: m.user.name,
        userEmail: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  });

  // POST /organizations - Create new organization
  app.post('/organizations', {
    preHandler: [validateBody(createOrganizationSchema)]
  }, async (req) => {
    const userId = (req as AuthenticatedRequest).user.id;
    const body = req.body as any;

    try {
      const organization = await prisma.organization.create({
        data: {
          name: body.name,
          description: body.description || null,
          members: {
            create: {
              userId,
              role: 'ADMIN', // Creator becomes admin
            },
          },
        },
        include: {
          members: true,
        },
      });

      // Update session to active this organization
      const session = (req as AuthenticatedRequest).session;
      await prisma.session.update({
        where: { id: session.id },
        data: { activeOrganizationId: organization.id },
      });

      return {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Organization name already exists');
      }
      throw error;
    }
  });

  // PUT /organizations/:id - Update organization (admin only)
  app.put('/organizations/:id', {
    preHandler: [validateParams(idParamSchema), validateBody(updateOrganizationSchema)]
  }, async (req) => {
    await requireOrganizationAdmin(req, (req as any).res);

    const orgContext = (req as AuthenticatedRequest).organizationContext;
    const orgId = (req as any).params.id;
    const body = req.body as any;

    if (orgContext.organizationId !== orgId) {
      throw new ForbiddenError('Cannot update a different organization');
    }

    try {
      const organization = await prisma.organization.update({
        where: { id: orgId },
        data: {
          name: body.name || undefined,
          description: body.description !== undefined ? body.description : undefined,
        },
      });

      return {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Organization name already exists');
      }
      if (error.code === 'P2025') {
        throw new NotFoundError('Organization not found');
      }
      throw error;
    }
  });

  // POST /organizations/switch - Switch active organization
  app.post('/organizations/switch', {
    preHandler: [validateBody(switchOrganizationSchema)]
  }, async (req) => {
    const userId = (req as AuthenticatedRequest).user.id;
    const session = (req as AuthenticatedRequest).session;
    const body = req.body as any;

    // Verify user is a member of the organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: body.organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new BadRequestError('User is not a member of this organization');
    }

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: body.organizationId },
    });

    return { success: true };
  });
}
