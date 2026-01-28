import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './db.js';
import { auth } from './auth.js';
import { convertFastifyHeaders } from './utils.js';
import { ForbiddenError, UnauthorizedError } from './errors/app-errors.js';

export interface OrganizationContext {
  organizationId: string;
  userRole: 'ADMIN' | 'MEMBER';
  userId: string;
  isAdmin: boolean;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ORGANIZATION_CONTEXT?: string;
    }
  }
}

// Extend FastifyRequest to include organization context
declare module 'fastify' {
  interface FastifyRequest {
    organizationContext?: OrganizationContext;
    user?: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      isAdmin?: boolean;
    };
    session?: any;
  }
}

export async function requireAuthSession(req: FastifyRequest, res: FastifyReply) {
  const headers = convertFastifyHeaders(req.headers);
  const sessionData = await auth.api.getSession({ headers });

  if (!sessionData) {
    throw new UnauthorizedError();
  }

  req.user = sessionData.user as any;
  req.session = sessionData.session;

  return sessionData;
}

export async function requireOrganization(req: FastifyRequest, res: FastifyReply) {
  const sessionData = await requireAuthSession(req, res);

  const sessionWithOrg = await prisma.session.findUnique({
    where: { id: sessionData.session.id },
    select: {
      id: true,
      activeOrganizationId: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isAdmin: true,
          organizationMemberships: {
            orderBy: { joinedAt: 'asc' },
            select: {
              organizationId: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!sessionWithOrg) {
    throw new UnauthorizedError('Session not found');
  }

  const memberships = sessionWithOrg.user.organizationMemberships;

  if (memberships.length === 0) {
    throw new ForbiddenError('User has no organizations');
  }

  const activeOrgId = sessionWithOrg.activeOrganizationId;
  const membership = activeOrgId
    ? memberships.find((m) => m.organizationId === activeOrgId)
    : memberships[0];

  const resolvedMembership = membership || memberships[0];

  if (!membership) {
    prisma.session.update({
      where: { id: sessionData.session.id },
      data: { activeOrganizationId: resolvedMembership.organizationId },
    }).catch((error) => {
      console.error('Failed to update session activeOrganizationId:', error);
    });
  }

  // Attach organization context to request
  req.organizationContext = {
    organizationId: resolvedMembership.organizationId,
    userRole: resolvedMembership.role as 'ADMIN' | 'MEMBER',
    userId: sessionData.user.id,
    isAdmin: !!sessionWithOrg.user.isAdmin
  };

  req.user = {
    id: sessionWithOrg.user.id,
    email: sessionWithOrg.user.email,
    name: sessionWithOrg.user.name,
    image: sessionWithOrg.user.image,
    isAdmin: sessionWithOrg.user.isAdmin
  } as any;
  req.session = sessionData.session;
}

export async function requireOrganizationAdmin(req: FastifyRequest, res: FastifyReply) {
  // First ensure we have organization context
  await requireOrganization(req, res);

  const orgRoleIsAdmin = req.organizationContext.userRole?.toUpperCase() === 'ADMIN';
  if (orgRoleIsAdmin) {
    return;
  }

  if (req.organizationContext.isAdmin) {
    return;
  }

  throw new ForbiddenError('Admin access required');
}

export async function organizationMiddleware(app: any) {
  app.addHook('preHandler', requireOrganization);
}
