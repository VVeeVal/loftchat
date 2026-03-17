import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { aggregateReactions, findUsersByNames, parseMentions } from '../utils/message-utils.js';
import { requireOrganization } from '../organization-middleware.js';
import { requireDMParticipant } from '../decorators/resource-guards.js';
import { validateBody, validateParams } from '../plugins/validator.js';
import { idParamSchema, messageIdParamSchema } from '../schemas/common.schemas.js';
import { pinMessageSchema } from '../schemas/channel.schemas.js';
import {
  createDMSessionSchema,
  editDMMessageSchema,
  archiveDMSchema,
  dmNotificationPreferenceSchema,
  reactionSchema,
  sendDMMessageSchema,
  starDMSchema
} from '../schemas/dm.schemas.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-errors.js';

export default async function dmRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  const dmMessageInclude = {
    sender: { select: { id: true, name: true, email: true, image: true } },
    _count: { select: { replies: true } },
    reactions: { include: { user: { select: { id: true, name: true } } } },
    mentions: { include: { user: { select: { id: true, name: true } } } },
    attachments: true
  } as const;

  const serializeDMMessage = <
    T extends { createdAt: Date; reactions: any[] }
  >(
    message: T,
    participants: Array<{ userId: string; lastReadAt: Date }>
  ) => ({
    ...message,
    readBy: participants
      .filter((participant) => participant.lastReadAt >= message.createdAt)
      .map((participant) => participant.userId),
    reactions: aggregateReactions(message.reactions)
  });
  // List DM Sessions with Unread
  app.get<{ Querystring: { includeArchived?: string } }>('/dms', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const includeArchived = req.query.includeArchived === 'true';

    const dms = await prisma.dMSession.findMany({
      where: {
        organizationId: orgContext.organizationId,
        ...(includeArchived ? {} : { isArchived: false }),
        participants: { some: { userId: user.id } }
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true, bio: true } } }
        }
      }
    });

    const dmsWithUnread = await Promise.all(dms.map(async (dm) => {
      const me = dm.participants.find((p) => p.userId === user.id);
      let unreadCount = 0;
      if (me) {
        if (me.notificationPreference === 'MENTIONS') {
          unreadCount = await prisma.dMMessage.count({
            where: {
              sessionId: dm.id,
              createdAt: { gt: me.lastReadAt },
              senderId: { not: user.id },
              mentions: { some: { userId: user.id } }
            }
          });
        } else if (me.notificationPreference !== 'MUTE') {
          unreadCount = await prisma.dMMessage.count({
            where: {
              sessionId: dm.id,
              createdAt: { gt: me.lastReadAt },
              senderId: { not: user.id } // Exclude own messages
            }
          });
        }
      }
      return {
        ...dm,
        unreadCount,
        isStarred: me ? me.isStarred : false,
        notificationPreference: me ? me.notificationPreference : 'ALL'
      };
    }));

    return dmsWithUnread;
  });

  // Mark DM Read
  app.post<{ Params: { id: string } }>('/dms/:id/read', {
    preHandler: [validateParams(idParamSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const part = await prisma.dMParticipant.update({
      where: { sessionId_userId: { sessionId: id, userId: user.id } },
      data: { lastReadAt: new Date() }
    });
    return part;
  });

  // Star/Unstar DM
  app.post<{ Params: { id: string }; Body: { isStarred: boolean } }>('/dms/:id/star', {
    preHandler: [validateParams(idParamSchema), validateBody(starDMSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const { isStarred } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.update({
      where: { sessionId_userId: { sessionId: id, userId: user.id } },
      data: { isStarred }
    });
    return participant;
  });

  // Update DM Notification Preference
  app.post<{ Params: { id: string }; Body: { preference: 'ALL' | 'MENTIONS' | 'MUTE' } }>('/dms/:id/notifications', {
    preHandler: [validateParams(idParamSchema), validateBody(dmNotificationPreferenceSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const { preference } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.update({
      where: { sessionId_userId: { sessionId: id, userId: user.id } },
      data: { notificationPreference: preference }
    });
    return participant;
  });

  // Archive/Unarchive DM
  app.post<{ Params: { id: string }; Body: { isArchived: boolean } }>('/dms/:id/archive', {
    preHandler: [validateParams(idParamSchema), validateBody(archiveDMSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const { isArchived } = req.body;

    const session = await prisma.dMSession.update({
      where: { id },
      data: { isArchived }
    });

    return session;
  });

  // Create or Get DM Session (Ensure lastRead is set on creation)
  app.post<{ Body: { targetUserId: string } }>('/dms', {
    preHandler: [validateBody(createDMSessionSchema)]
  }, async (req, res) => {
    const { targetUserId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    if (targetUserId === user.id) {
      throw new BadRequestError('Cannot DM yourself');
    }

    // Verify target user is in the same organization
    const targetMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgContext.organizationId,
          userId: targetUserId
        }
      }
    });

    if (!targetMembership) {
      throw new ForbiddenError('User is not in this organization');
    }

    const existingSessions = await prisma.dMSession.findMany({
      where: {
        organizationId: orgContext.organizationId,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: targetUserId } } }
        ]
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      }
    });

    if (existingSessions.length > 0) {
      return existingSessions[0];
    }

    const session = await prisma.dMSession.create({
      data: {
        organizationId: orgContext.organizationId,
        participants: {
          create: [
            { userId: user.id, lastReadAt: new Date() },
            { userId: targetUserId, lastReadAt: new Date() }
          ]
        }
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      }
    });
    return session;
  });

  // Get DM Messages (Threading Support)
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; threadId?: string } }>('/dms/:id', {
    preHandler: [validateParams(idParamSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const { cursor, threadId } = req.query;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const session = await prisma.dMSession.findFirst({
      where: { id, organizationId: orgContext.organizationId },
      include: { participants: { include: { user: true } } }
    });

    if (!session || !session.participants.some((p) => p.userId === user.id)) {
      throw new NotFoundError('DM not found');
    }

    const where: any = { sessionId: id };
    if (threadId) {
      where.threadId = threadId;
    } else {
      where.threadId = null;
    }

    const messages = await prisma.dMMessage.findMany({
      where,
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: dmMessageInclude
    });

    const readByLookup = new Map<string, string[]>();
    for (const message of messages) {
      const readBy = session.participants
        .filter((participant) => participant.lastReadAt >= message.createdAt)
        .map((participant) => participant.userId);
      readByLookup.set(message.id, readBy);
    }

    const messagesWithAggregatedReactions = messages
      .slice()
      .reverse()
      .map((message) => ({
        ...message,
        readBy: readByLookup.get(message.id) || [],
        reactions: aggregateReactions(message.reactions)
      }));

    return { session, messages: messagesWithAggregatedReactions };
  });

  // Get Pinned DM Messages
  app.get<{ Params: { id: string } }>('/dms/:id/pinned', {
    preHandler: [validateParams(idParamSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId: id, userId: user.id }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this DM');
    }

    const messages = await prisma.dMMessage.findMany({
      where: { sessionId: id, isPinned: true, threadId: null },
      orderBy: { createdAt: 'desc' },
      include: dmMessageInclude
    });

    const participants = await prisma.dMParticipant.findMany({
      where: { sessionId: id },
      select: { userId: true, lastReadAt: true }
    });

    return messages.map((message) => serializeDMMessage(message, participants));
  });

  // Pin/Unpin DM Message
  app.post<{ Params: { id: string; messageId: string }; Body: { isPinned?: boolean } }>('/dms/:id/messages/:messageId/pin', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(pinMessageSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id: sessionId, messageId } = req.params;
    const { isPinned } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId, userId: user.id }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this DM');
    }

    const message = await prisma.dMMessage.findFirst({
      where: { id: messageId, sessionId }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const updated = await prisma.dMMessage.update({
      where: { id: messageId },
      data: { isPinned: isPinned ?? !message.isPinned },
      include: dmMessageInclude
    });

    const participants = await prisma.dMParticipant.findMany({
      where: { sessionId },
      select: { userId: true, lastReadAt: true }
    });

    return serializeDMMessage(updated, participants);
  });

  // Send DM Message (Threading Support)
  app.post<{ Params: { id: string }; Body: { content: string; threadId?: string; attachments?: { url: string; filename: string; mimetype: string; size: number; uploadId?: string }[] } }>('/dms/:id/messages', {
    preHandler: [validateParams(idParamSchema), validateBody(sendDMMessageSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id } = req.params;
    const { content, threadId, attachments = [] } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId: id, userId: user.id }
    });
    if (!participant) {
      throw new ForbiddenError('Not in session');
    }

    const mentionedNames = parseMentions(content);
    const mentionedUsers = await findUsersByNames(mentionedNames, orgContext.organizationId);
    let parentMessageId: string | null = null;

    if (threadId) {
      const parentMessage = await prisma.dMMessage.findFirst({
        where: {
          id: threadId,
          sessionId: id,
          threadId: null
        },
        select: { id: true }
      });

      if (!parentMessage) {
        throw new BadRequestError('Invalid thread parent');
      }

      parentMessageId = parentMessage.id;
    }

    const uploadIds = attachments
      .map((attachment) => attachment.uploadId)
      .filter((uploadId): uploadId is string => typeof uploadId === 'string');
    const uniqueUploadIds = [...new Set(uploadIds)];
    let uploadLookup = new Map<string, { url: string; filename: string; mimetype: string; size: number }>();

    if (uniqueUploadIds.length > 0) {
      const uploads = await prisma.upload.findMany({
        where: {
          id: { in: uniqueUploadIds },
          organizationId: orgContext.organizationId,
          userId: user.id
        },
        select: { id: true, url: true, filename: true, mimetype: true, size: true }
      });

      if (uploads.length !== uniqueUploadIds.length) {
        throw new BadRequestError('Invalid attachment upload');
      }
      uploadLookup = new Map(uploads.map((upload) => [upload.id, upload]));
    }

    const message = await prisma.dMMessage.create({
      data: {
        content,
        sessionId: id,
        senderId: user.id,
        threadId: parentMessageId,
        mentions: {
          create: mentionedUsers.map((mentionedUser) => ({ userId: mentionedUser.id }))
        },
        attachments: {
          create: attachments.map((attachment) => {
            if (attachment.uploadId) {
              const upload = uploadLookup.get(attachment.uploadId);
              if (!upload) {
                throw new BadRequestError('Invalid attachment upload');
              }
              return {
                url: upload.url,
                filename: upload.filename,
                mimetype: upload.mimetype,
                size: upload.size,
                uploadId: attachment.uploadId
              };
            }
            return {
              url: attachment.url,
              filename: attachment.filename,
              mimetype: attachment.mimetype,
              size: attachment.size,
              uploadId: null
            };
          })
        }
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { replies: true } },
        mentions: { include: { user: { select: { id: true, name: true } } } },
        attachments: true
      }
    });

    const participants = await prisma.dMParticipant.findMany({
      where: { sessionId: id },
      select: { userId: true, lastReadAt: true }
    });

    if (parentMessageId) {
      const updatedParent = await prisma.dMMessage.update({
        where: { id: parentMessageId },
        data: {
          replyCount: { increment: 1 },
        },
        include: dmMessageInclude
      });

      await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
        type: 'UPDATE',
        sessionId: id,
        message: serializeDMMessage(updatedParent, participants)
      })})`;
    }

    const messageWithReactions = { ...message, readBy: [user.id], reactions: [] };

    await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
      type: 'INSERT',
      sessionId: id,
      organizationId: orgContext.organizationId,
      message: messageWithReactions,
      participantIds: participants.map((participant) => participant.userId)
    })})`;

    return messageWithReactions;
  });

  // Edit DM Message
  app.put<{ Params: { id: string; messageId: string }; Body: { content: string } }>('/dms/:id/messages/:messageId', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(editDMMessageSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id: sessionId, messageId } = req.params;
    const { content } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId, userId: user.id }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this DM');
    }

    const message = await prisma.dMMessage.findFirst({
      where: { id: messageId, sessionId, senderId: user.id }
    });

    if (!message) {
      throw new ForbiddenError('Message not found or not yours');
    }

    const mentionedNames = parseMentions(content);
    const mentionedUsers = await findUsersByNames(mentionedNames, orgContext.organizationId);

    const updatedMessage = await prisma.$transaction(async (tx) => {
      await tx.dMMention.deleteMany({ where: { dmMessageId: messageId } });

      return tx.dMMessage.update({
        where: { id: messageId },
        data: {
          content,
          isEdited: true,
          mentions: {
            create: mentionedUsers.map((mentionedUser) => ({ userId: mentionedUser.id }))
          }
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { replies: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          mentions: { include: { user: { select: { id: true, name: true } } } },
          attachments: true
        }
      });
    });

    const participants = await prisma.dMParticipant.findMany({
      where: { sessionId },
      select: { userId: true, lastReadAt: true }
    });

    const readBy = participants
      .filter((participant) => participant.lastReadAt >= updatedMessage.createdAt)
      .map((participant) => participant.userId);

    const messageWithAggregatedReactions = {
      ...updatedMessage,
      readBy,
      reactions: aggregateReactions(updatedMessage.reactions)
    };

    await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
      type: 'UPDATE',
      sessionId,
      message: messageWithAggregatedReactions
    })})`;

    return messageWithAggregatedReactions;
  });

  // Delete DM Message
  app.delete<{ Params: { id: string; messageId: string } }>('/dms/:id/messages/:messageId', {
    preHandler: [validateParams(messageIdParamSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id: sessionId, messageId } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId, userId: user.id }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this DM');
    }

    const message = await prisma.dMMessage.findFirst({
      where: { id: messageId, sessionId, senderId: user.id },
      include: { _count: { select: { replies: true } } }
    });

    if (!message) {
      throw new ForbiddenError('Message not found or not yours');
    }

    if (message._count.replies > 0) {
      const updatedMessage = await prisma.$transaction(async (tx) => {
        await tx.dMMention.deleteMany({ where: { dmMessageId: messageId } });
        await tx.dMReaction.deleteMany({ where: { dmMessageId: messageId } });
        await tx.dMAttachment.deleteMany({ where: { dmMessageId: messageId } });

        return tx.dMMessage.update({
          where: { id: messageId },
          data: {
            content: 'This message has been deleted',
            isEdited: false,
            isPinned: false
          },
          include: {
            sender: true,
            _count: { select: { replies: true } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
            mentions: { include: { user: { select: { id: true, name: true } } } },
            attachments: true
          }
        });
      });

      const messageWithAggregatedReactions = {
        ...updatedMessage,
        reactions: aggregateReactions(updatedMessage.reactions)
      };

      await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
        type: 'UPDATE',
        sessionId,
        message: messageWithAggregatedReactions
      })})`;

      return messageWithAggregatedReactions;
    }

    if (message.threadId) {
      const participants = await prisma.dMParticipant.findMany({
        where: { sessionId },
        select: { userId: true, lastReadAt: true }
      });

      const updatedParent = await prisma.dMMessage.update({
        where: { id: message.threadId },
        data: { replyCount: { decrement: 1 } },
        include: dmMessageInclude
      });

      await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
        type: 'UPDATE',
        sessionId,
        message: serializeDMMessage(updatedParent, participants)
      })})`;
    }

    await prisma.dMMessage.delete({ where: { id: messageId } });

    await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
      type: 'DELETE',
      sessionId,
      messageId,
      threadId: message.threadId
    })})`;

    return { success: true };
  });

  // Toggle DM Message Reaction
  app.post<{ Params: { id: string; messageId: string }; Body: { emoji: string } }>('/dms/:id/messages/:messageId/reactions', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(reactionSchema), requireDMParticipant]
  }, async (req, res) => {
    const { id: sessionId, messageId } = req.params;
    const { emoji } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const participant = await prisma.dMParticipant.findFirst({
      where: { sessionId, userId: user.id }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this DM');
    }

    const message = await prisma.dMMessage.findFirst({
      where: { id: messageId, sessionId }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const existingReaction = await prisma.dMReaction.findUnique({
      where: {
        dmMessageId_userId_emoji: { dmMessageId: messageId, userId: user.id, emoji }
      }
    });

    if (existingReaction) {
      await prisma.dMReaction.delete({ where: { id: existingReaction.id } });
    } else {
      await prisma.dMReaction.create({
        data: { dmMessageId: messageId, userId: user.id, emoji }
      });
    }

    const reactions = await prisma.dMReaction.findMany({
      where: { dmMessageId: messageId },
      include: { user: { select: { id: true, name: true } } }
    });

    const aggregatedReactions = aggregateReactions(reactions);

    await prisma.$executeRaw`SELECT pg_notify('dm_events', ${JSON.stringify({
      type: 'REACTION',
      sessionId,
      messageId,
      reactions: aggregatedReactions
    })})`;

    return { reactions: aggregatedReactions };
  });
}
