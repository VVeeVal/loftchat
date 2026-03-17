import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization } from '../organization-middleware.js';
import { validateBody, validateParams } from '../plugins/validator.js';
import {
  createWorkUnitSchema,
  updateWorkUnitSchema,
  updateWorkUnitStatusSchema,
  assignAgentSchema,
  addReviewerSchema,
  workUnitMessageSchema,
  workUnitIdParamSchema,
  workUnitAgentParamSchema,
  workUnitReviewerParamSchema
} from '../schemas/work-unit.schemas.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-errors.js';
import { eventPublisher } from '../services/event-publisher.js';

export default async function workUnitRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  const buildWorkUnitVisibilityWhere = (userId: string, orgId: string) => ({
    organizationId: orgId,
    OR: [
      {
        sourceMessage: {
          channel: {
            OR: [
              { isPrivate: false },
              { members: { some: { userId } } },
              { createdBy: userId }
            ]
          }
        }
      },
      {
        sourceDMMessage: {
          session: {
            participants: { some: { userId } }
          }
        }
      },
      {
        sourceMessageId: null,
        sourceDMMessageId: null,
        OR: [
          { ownerId: userId },
          { reviewers: { some: { userId } } },
          { assignedAgents: { some: { botUser: { userId } } } }
        ]
      }
    ]
  });

  const getAccessibleWorkUnit = async (workUnitId: string, userId: string, orgId: string) => {
    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id: workUnitId,
        ...buildWorkUnitVisibilityWhere(userId, orgId)
      },
      include: {
        reviewers: true,
        assignedAgents: {
          include: {
            botUser: true
          }
        }
      }
    });

    if (!workUnit) return null;

    return {
      workUnit,
      isOwner: workUnit.ownerId === userId,
      isReviewer: workUnit.reviewers.some((reviewer) => reviewer.userId === userId),
      isAssignedAgent: workUnit.assignedAgents.some((agent) => agent.botUser.userId === userId)
    };
  };

  // ===== List Work Units =====
  app.get<{
    Querystring: {
      status?: string;
      ownerId?: string;
    }
  }>('/work-units', async (req) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const { status, ownerId } = req.query;

    const where: any = buildWorkUnitVisibilityWhere(user.id, orgContext.organizationId);

    if (status) {
      where.status = status;
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    const workUnits = await prisma.workUnit.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        },
        assignedAgents: {
          include: {
            botUser: {
              include: {
                user: { select: { id: true, name: true, image: true } },
                app: { select: { id: true, name: true, iconUrl: true } }
              }
            }
          }
        },
        reviewers: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        },
        _count: {
          select: {
            messages: true,
            outputs: true
          }
        }
      }
    });

    return workUnits;
  });

  // ===== Get Single Work Unit =====
  app.get<{ Params: { id: string } }>('/work-units/:id', {
    preHandler: [validateParams(workUnitIdParamSchema)]
  }, async (req) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        ...buildWorkUnitVisibilityWhere(user.id, orgContext.organizationId)
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        },
        sourceMessage: {
          include: {
            sender: { select: { id: true, name: true, image: true } },
            channel: { select: { id: true, name: true } }
          }
        },
        sourceDMMessage: {
          include: {
            sender: { select: { id: true, name: true, image: true } }
          }
        },
        assignedAgents: {
          include: {
            botUser: {
              include: {
                user: { select: { id: true, name: true, image: true } },
                app: { select: { id: true, name: true, iconUrl: true } }
              }
            }
          }
        },
        reviewers: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        },
        outputs: {
          orderBy: { createdAt: 'desc' },
          include: {
            botUser: {
              include: {
                app: { select: { id: true, name: true, iconUrl: true } }
              }
            },
            user: { select: { id: true, name: true, image: true } }
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    return workUnit;
  });

  // ===== Create Work Unit =====
  app.post<{
    Body: {
      title: string;
      goal: string;
      context?: string;
      sourceMessageId?: string;
      sourceDMMessageId?: string;
    }
  }>('/work-units', {
    preHandler: [validateBody(createWorkUnitSchema)]
  }, async (req) => {
    const { title, goal, context, sourceMessageId, sourceDMMessageId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    // Validate source message if provided
    if (sourceMessageId) {
      const message = await prisma.message.findFirst({
        where: {
          id: sourceMessageId,
          channel: {
            organizationId: orgContext.organizationId,
            OR: [
              { isPrivate: false },
              { members: { some: { userId: user.id } } },
              { createdBy: user.id }
            ]
          }
        }
      });
      if (!message) {
        throw new BadRequestError('Source message not found or not accessible');
      }
    }

    if (sourceDMMessageId) {
      const dmMessage = await prisma.dMMessage.findFirst({
        where: {
          id: sourceDMMessageId,
          session: {
            organizationId: orgContext.organizationId,
            participants: { some: { userId: user.id } }
          }
        }
      });
      if (!dmMessage) {
        throw new BadRequestError('Source DM message not found or not accessible');
      }
    }

    const workUnit = await prisma.workUnit.create({
      data: {
        title,
        goal,
        context,
        sourceMessageId,
        sourceDMMessageId,
        ownerId: user.id,
        organizationId: orgContext.organizationId,
        status: 'DRAFT'
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    return workUnit;
  });

  // ===== Update Work Unit =====
  app.put<{
    Params: { id: string };
    Body: {
      title?: string;
      goal?: string;
      context?: string | null;
    }
  }>('/work-units/:id', {
    preHandler: [validateParams(workUnitIdParamSchema), validateBody(updateWorkUnitSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { title, goal, context } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== user.id) {
      throw new ForbiddenError('Only the owner can update this work unit');
    }

    const updated = await prisma.workUnit.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(goal !== undefined && { goal }),
        ...(context !== undefined && { context })
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    return updated;
  });

  // ===== Update Work Unit Status =====
  app.post<{
    Params: { id: string };
    Body: { status: string }
  }>('/work-units/:id/status', {
    preHandler: [validateParams(workUnitIdParamSchema), validateBody(updateWorkUnitStatusSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const access = await getAccessibleWorkUnit(id, user.id, orgContext.organizationId);
    if (!access) {
      throw new NotFoundError('Work unit not found');
    }

    // Only owners and reviewers can set any status
    // Assigned agents (bots) would use the bot API which has different restrictions
    if (!access.isOwner && !access.isReviewer) {
      throw new ForbiddenError('Only owners and reviewers can update status');
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (access.workUnit.status === 'COMPLETED' && status !== 'COMPLETED') {
      updateData.completedAt = null;
    }

    const updated = await prisma.workUnit.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        },
        assignedAgents: {
          include: {
            botUser: {
              include: {
                app: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    // Publish event to assigned agents
    for (const agent of updated.assignedAgents) {
      await eventPublisher.publishEvent(
        orgContext.organizationId,
        'work_unit.status_changed',
        {
          type: 'work_unit.status_changed',
          work_unit_id: id,
          old_status: access.workUnit.status,
          new_status: status,
          changed_by: user.id
        }
      ).catch(err => console.error('Failed to publish work_unit.status_changed event:', err));
    }

    return updated;
  });

  // ===== Delete Work Unit =====
  app.delete<{ Params: { id: string } }>('/work-units/:id', {
    preHandler: [validateParams(workUnitIdParamSchema)]
  }, async (req) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== user.id) {
      throw new ForbiddenError('Only the owner can delete this work unit');
    }

    await prisma.workUnit.delete({ where: { id } });

    return { success: true };
  });

  // ===== Get Available Agents =====
  app.get('/work-units/available-agents', async (req) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const botUsers = await prisma.botUser.findMany({
      where: {
        organizationId: orgContext.organizationId,
        isActive: true
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
        app: { select: { id: true, name: true, iconUrl: true, description: true } }
      }
    });

    return botUsers;
  });

  // ===== Assign Agent =====
  app.post<{
    Params: { id: string };
    Body: { botUserId: string }
  }>('/work-units/:id/agents', {
    preHandler: [validateParams(workUnitIdParamSchema), validateBody(assignAgentSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { botUserId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== user.id) {
      throw new ForbiddenError('Only the owner can assign agents');
    }

    // Verify bot user exists and is active
    const botUser = await prisma.botUser.findFirst({
      where: {
        id: botUserId,
        organizationId: orgContext.organizationId,
        isActive: true
      },
      include: {
        app: { select: { id: true, name: true } }
      }
    });

    if (!botUser) {
      throw new BadRequestError('Bot user not found or inactive');
    }

    // Create assignment
    const assignment = await prisma.workUnitAgent.upsert({
      where: {
        workUnitId_botUserId: { workUnitId: id, botUserId }
      },
      create: {
        workUnitId: id,
        botUserId
      },
      update: {},
      include: {
        botUser: {
          include: {
            user: { select: { id: true, name: true, image: true } },
            app: { select: { id: true, name: true, iconUrl: true } }
          }
        }
      }
    });

    // Publish event
    await eventPublisher.publishEvent(
      orgContext.organizationId,
      'work_unit.agent_assigned',
      {
        type: 'work_unit.agent_assigned',
        work_unit_id: id,
        work_unit_title: workUnit.title,
        work_unit_goal: workUnit.goal,
        bot_user_id: botUserId,
        assigned_by: user.id
      }
    ).catch(err => console.error('Failed to publish work_unit.agent_assigned event:', err));

    return assignment;
  });

  // ===== Remove Agent =====
  app.delete<{ Params: { id: string; botUserId: string } }>('/work-units/:id/agents/:botUserId', {
    preHandler: [validateParams(workUnitAgentParamSchema)]
  }, async (req) => {
    const { id, botUserId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== user.id) {
      throw new ForbiddenError('Only the owner can remove agents');
    }

    await prisma.workUnitAgent.deleteMany({
      where: {
        workUnitId: id,
        botUserId
      }
    });

    return { success: true };
  });

  // ===== Add Reviewer =====
  app.post<{
    Params: { id: string };
    Body: { userId: string }
  }>('/work-units/:id/reviewers', {
    preHandler: [validateParams(workUnitIdParamSchema), validateBody(addReviewerSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { userId } = req.body;
    const currentUser = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== currentUser.id) {
      throw new ForbiddenError('Only the owner can add reviewers');
    }

    // Verify user is in the organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgContext.organizationId,
          userId
        }
      }
    });

    if (!membership) {
      throw new BadRequestError('User is not in this organization');
    }

    const reviewer = await prisma.workUnitReviewer.upsert({
      where: {
        workUnitId_userId: { workUnitId: id, userId }
      },
      create: {
        workUnitId: id,
        userId
      },
      update: {},
      include: {
        user: { select: { id: true, name: true, email: true, image: true } }
      }
    });

    return reviewer;
  });

  // ===== Remove Reviewer =====
  app.delete<{ Params: { id: string; userId: string } }>('/work-units/:id/reviewers/:userId', {
    preHandler: [validateParams(workUnitReviewerParamSchema)]
  }, async (req) => {
    const { id, userId } = req.params;
    const currentUser = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await prisma.workUnit.findFirst({
      where: {
        id,
        organizationId: orgContext.organizationId
      }
    });

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    if (workUnit.ownerId !== currentUser.id) {
      throw new ForbiddenError('Only the owner can remove reviewers');
    }

    await prisma.workUnitReviewer.deleteMany({
      where: {
        workUnitId: id,
        userId
      }
    });

    return { success: true };
  });

  // ===== Get Work Unit Messages =====
  app.get<{
    Params: { id: string };
    Querystring: { cursor?: string }
  }>('/work-units/:id/messages', {
    preHandler: [validateParams(workUnitIdParamSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { cursor } = req.query;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await getAccessibleWorkUnit(id, user.id, orgContext.organizationId);

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    const messages = await prisma.workUnitMessage.findMany({
      where: { workUnitId: id },
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    return messages;
  });

  // ===== Send Work Unit Message =====
  app.post<{
    Params: { id: string };
    Body: { content: string }
  }>('/work-units/:id/messages', {
    preHandler: [validateParams(workUnitIdParamSchema), validateBody(workUnitMessageSchema)]
  }, async (req) => {
    const { id } = req.params;
    const { content } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const access = await getAccessibleWorkUnit(id, user.id, orgContext.organizationId);
    if (!access) {
      throw new NotFoundError('Work unit not found');
    }

    const message = await prisma.workUnitMessage.create({
      data: {
        workUnitId: id,
        senderId: user.id,
        content
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    // Publish real-time event
    await prisma.$executeRaw`SELECT pg_notify('work_unit_events', ${JSON.stringify({
      type: 'MESSAGE',
      workUnitId: id,
      organizationId: orgContext.organizationId,
      message
    })})`;

    // Publish event to assigned agents
    for (const agent of access.workUnit.assignedAgents) {
      await eventPublisher.publishEvent(
        orgContext.organizationId,
        'work_unit.message',
        {
          type: 'work_unit.message',
          work_unit_id: id,
          message_id: message.id,
          content: message.content,
          sender_id: user.id
        }
      ).catch(err => console.error('Failed to publish work_unit.message event:', err));
    }

    return message;
  });

  // ===== Get Work Unit Outputs =====
  app.get<{ Params: { id: string } }>('/work-units/:id/outputs', {
    preHandler: [validateParams(workUnitIdParamSchema)]
  }, async (req) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const workUnit = await getAccessibleWorkUnit(id, user.id, orgContext.organizationId);

    if (!workUnit) {
      throw new NotFoundError('Work unit not found');
    }

    const outputs = await prisma.workUnitOutput.findMany({
      where: { workUnitId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        botUser: {
          include: {
            app: { select: { id: true, name: true, iconUrl: true } }
          }
        },
        user: { select: { id: true, name: true, image: true } }
      }
    });

    return outputs;
  });
}
