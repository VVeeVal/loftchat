import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { ForbiddenError, NotFoundError } from '../errors/app-errors.js';

type OrgModel = 'channel' | 'dMSession';

export function requireOrgResource(model: OrgModel, idParam: string = 'id') {
  return async (req: FastifyRequest, res: FastifyReply) => {
    const orgContext = (req as any).organizationContext;
    const resourceId = (req.params as any)[idParam];

    if (!orgContext) {
      throw new ForbiddenError('No organization context');
    }

    const resource = await (prisma as any)[model].findFirst({
      where: {
        id: resourceId,
        organizationId: orgContext.organizationId
      }
    });

    if (!resource) {
      const label = model === 'dMSession' ? 'DM session' : 'Channel';
      throw new NotFoundError(`${label} not found`);
    }

    (req as any)[model] = resource;
  };
}

export async function requireChannelAccess(req: FastifyRequest, _res: FastifyReply) {
  const orgContext = (req as any).organizationContext;
  const user = (req as any).user;
  const channelId = (req.params as any).id;

  if (!orgContext || !user) {
    throw new ForbiddenError('No organization context');
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      organizationId: orgContext.organizationId,
    },
    include: {
      members: {
        where: {
          userId: user.id,
        },
        select: {
          userId: true,
        },
      },
    },
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const hasAccess = !channel.isPrivate || channel.createdBy === user.id || channel.members.length > 0;
  if (!hasAccess) {
    throw new NotFoundError('Channel not found');
  }

  (req as any).channel = channel;
}

export async function requireChannelMembership(req: FastifyRequest, res: FastifyReply) {
  await requireChannelAccess(req, res);

  const channel = (req as any).channel;
  const user = (req as any).user;
  const isMember = channel.createdBy === user.id || channel.members.some((member: { userId: string }) => member.userId === user.id);

  if (!isMember) {
    throw new ForbiddenError('Not a channel member');
  }
}

export async function requireDMParticipant(req: FastifyRequest, _res: FastifyReply) {
  const orgContext = (req as any).organizationContext;
  const user = (req as any).user;
  const sessionId = (req.params as any).id;

  if (!orgContext || !user) {
    throw new ForbiddenError('No organization context');
  }

  const session = await prisma.dMSession.findFirst({
    where: {
      id: sessionId,
      organizationId: orgContext.organizationId,
      participants: {
        some: {
          userId: user.id,
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError('DM session not found');
  }

  (req as any).dMSession = session;
}
