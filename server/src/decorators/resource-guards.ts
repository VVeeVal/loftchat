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
