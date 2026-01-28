import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { aggregateReactions, findUsersByNames, parseMentions } from '../utils/message-utils.js';
import { requireOrganization } from '../organization-middleware.js';
import { requireOrgResource } from '../decorators/resource-guards.js';
import { validateBody, validateParams } from '../plugins/validator.js';
import { idParamSchema, messageIdParamSchema } from '../schemas/common.schemas.js';
import {
  addChannelMemberSchema,
  createChannelSchema,
  channelNotificationPreferenceSchema,
  editChannelMessageSchema,
  archiveChannelSchema,
  pinMessageSchema,
  reactionSchema,
  sendChannelMessageSchema,
  starChannelSchema
} from '../schemas/channel.schemas.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-errors.js';

export default async function channelRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);
  // List Channels with Unread Counts
  app.get<{ Querystring: { includeArchived?: string } }>('/channels', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const includeArchived = req.query.includeArchived === 'true';

    const channels = await prisma.channel.findMany({
      where: {
        organizationId: orgContext.organizationId,
        ...(includeArchived ? {} : { isArchived: false }),
        OR: [
          { isPrivate: false },
          { members: { some: { userId: user.id } } },
          { createdBy: user.id }
        ]
      },
      include: {
        creator: true,
        members: { where: { userId: user.id } }
      }
    });

    const channelsWithUnread = await Promise.all(channels.map(async (c) => {
      const member = (c as any).members[0];
      let unreadCount = 0;
      if (member) {
        if (member.notificationPreference === 'MENTIONS') {
          unreadCount = await prisma.message.count({
            where: {
              channelId: c.id,
              createdAt: { gt: member.lastReadAt },
              senderId: { not: user.id },
              OR: [
                { mentions: { some: { userId: user.id } } },
                { senderId: 'system' }
              ]
            }
          });
        } else if (member.notificationPreference !== 'MUTE') {
          unreadCount = await prisma.message.count({
            where: {
              channelId: c.id,
              createdAt: { gt: member.lastReadAt },
              senderId: { not: user.id } // Exclude own messages
            }
          });
        }
      }
      return {
        ...c,
        unreadCount,
        isStarred: member ? member.isStarred : false,
        notificationPreference: member ? member.notificationPreference : 'ALL'
      };
    }));

    return channelsWithUnread;
  });

  // Mark Channel Read
  app.post<{ Params: { id: string } }>('/channels/:id/read', {
    preHandler: [validateParams(idParamSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const member = await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: id, userId: user.id } },
      create: {
        channelId: id,
        userId: user.id,
        role: 'MEMBER',
        lastReadAt: new Date()
      },
      update: {
        lastReadAt: new Date()
      }
    });
    return member;
  });

  // Create Channel
  app.post<{ Body: { name: string; description?: string; isPrivate?: boolean } }>('/channels', {
    preHandler: [validateBody(createChannelSchema)]
  }, async (req, res) => {
    const { name, description, isPrivate } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    try {
      const channel = await prisma.channel.create({
        data: {
          name,
          description,
          isPrivate: !!isPrivate,
          createdBy: user.id,
          organizationId: orgContext.organizationId,
          members: {
            create: {
              userId: user.id,
              role: 'ADMIN',
              lastReadAt: new Date()
            }
          }
        }
      });
      return channel;
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictError('Channel name already exists in this organization');
      }
      throw e;
    }
  });

  // Star/Unstar Channel
  app.post<{ Params: { id: string }; Body: { isStarred: boolean } }>('/channels/:id/star', {
    preHandler: [validateParams(idParamSchema), validateBody(starChannelSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const { isStarred } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const member = await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: id, userId: user.id } },
      create: {
        channelId: id,
        userId: user.id,
        role: 'MEMBER',
        isStarred
      },
      update: { isStarred }
    });
    return member;
  });

  // Update Channel Notification Preference
  app.post<{ Params: { id: string }; Body: { preference: 'ALL' | 'MENTIONS' | 'MUTE' } }>('/channels/:id/notifications', {
    preHandler: [validateParams(idParamSchema), validateBody(channelNotificationPreferenceSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const { preference } = req.body;
    const user = (req as AuthenticatedRequest).user;

    const member = await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: id, userId: user.id } },
      create: {
        channelId: id,
        userId: user.id,
        role: 'MEMBER',
        notificationPreference: preference
      },
      update: { notificationPreference: preference }
    });
    return member;
  });

  // Archive/Unarchive Channel
  app.post<{ Params: { id: string }; Body: { isArchived: boolean } }>('/channels/:id/archive', {
    preHandler: [validateParams(idParamSchema), validateBody(archiveChannelSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const { isArchived } = req.body;

    const channel = await prisma.channel.update({
      where: { id },
      data: { isArchived }
    });

    return channel;
  });

  // Get Channel & Messages (Fetch Thread if requested)
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; threadId?: string } }>('/channels/:id', {
    preHandler: [validateParams(idParamSchema)]
  }, async (req, res) => {
    const { id } = req.params;
    const { cursor, threadId } = req.query;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const channel = await prisma.channel.findFirst({
      where: { id, organizationId: orgContext.organizationId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        }
      }
    });

    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    const where: any = { channelId: id };
    if (threadId) {
      where.threadId = threadId;
    } else {
      where.threadId = null; // Top level messages only
    }

    const messages = await prisma.message.findMany({
      where,
      take: 50,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
        _count: { select: { replies: true } },
        reactions: {
          include: { user: { select: { id: true, name: true } } }
        },
        mentions: {
          include: { user: { select: { id: true, name: true } } }
        },
        attachments: true
      }
    });

    const messagesWithAggregatedReactions = messages.map((message) => ({
      ...message,
      reactions: aggregateReactions(message.reactions)
    }));

    return { channel, messages: messagesWithAggregatedReactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) };
  });

  // Get Pinned Messages
  app.get<{ Params: { id: string } }>('/channels/:id/pinned', {
    preHandler: [validateParams(idParamSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;

    const messages = await prisma.message.findMany({
      where: { channelId: id, isPinned: true, threadId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: true,
        _count: { select: { replies: true } },
        reactions: {
          include: { user: { select: { id: true, name: true } } }
        },
        mentions: {
          include: { user: { select: { id: true, name: true } } }
        },
        attachments: true
      }
    });

    const messagesWithAggregatedReactions = messages.map((message) => ({
      ...message,
      reactions: aggregateReactions(message.reactions)
    }));

    return messagesWithAggregatedReactions;
  });

  // Pin/Unpin Message
  app.post<{ Params: { id: string; messageId: string }; Body: { isPinned?: boolean } }>('/channels/:id/messages/:messageId/pin', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(pinMessageSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id: channelId, messageId } = req.params;
    const { isPinned } = req.body;

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: isPinned ?? !message.isPinned },
      include: {
        sender: true,
        _count: { select: { replies: true } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
        mentions: { include: { user: { select: { id: true, name: true } } } },
        attachments: true
      }
    });

    return {
      ...updated,
      reactions: aggregateReactions(updated.reactions)
    };
  });

  // Send Message (Support Threading)
  app.post<{ Params: { id: string }; Body: { content: string; threadId?: string; attachments?: { url: string; filename: string; mimetype: string; size: number; uploadId?: string }[] } }>('/channels/:id/messages', {
    preHandler: [validateParams(idParamSchema), validateBody(sendChannelMessageSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const { content, threadId, attachments = [] } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const mentionedNames = parseMentions(content);
    const mentionedUsers = await findUsersByNames(mentionedNames, orgContext.organizationId);

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

    const message = await prisma.message.create({
      data: {
        content,
        channelId: id,
        senderId: user.id,
        threadId: threadId || null,
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
        sender: true,
        _count: { select: { replies: true } },
        mentions: { include: { user: { select: { id: true, name: true } } } },
        attachments: true
      }
    });

    if (threadId) {
      await prisma.message.update({
        where: { id: threadId },
        data: {
          replyCount: { increment: 1 },
          updatedAt: new Date()
        }
      });
    }

    const messageWithReactions = { ...message, reactions: [] };
    const channelMeta = await prisma.channel.findUnique({
      where: { id },
      select: {
        isPrivate: true,
        createdBy: true,
        members: { select: { userId: true } }
      }
    });
    const channelMemberIds = channelMeta
      ? Array.from(new Set([
        channelMeta.createdBy,
        ...channelMeta.members.map((member) => member.userId)
      ]))
      : [];

    await prisma.$executeRaw`SELECT pg_notify('channel_events', ${JSON.stringify({
      type: 'INSERT',
      channelId: id,
      organizationId: orgContext.organizationId,
      message: messageWithReactions,
      channelIsPrivate: channelMeta?.isPrivate ?? false,
      channelMemberIds: channelMeta?.isPrivate ? channelMemberIds : undefined
    })})`;

    return messageWithReactions;
  });

  // Join Channel
  app.post<{ Params: { id: string } }>('/channels/:id/join', {
    preHandler: [validateParams(idParamSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    try {
      const member = await prisma.channelMember.create({
        data: { channelId: id, userId: user.id }
      });
      return member;
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictError('Already joined');
      }
      throw e;
    }
  });

  // Add Channel Member
  app.post<{ Params: { id: string }; Body: { userId?: string } }>('/channels/:id/members', {
    preHandler: [validateParams(idParamSchema), validateBody(addChannelMemberSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const requesterMembership = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: id, userId: user.id } }
    });

    if (!requesterMembership) {
      throw new ForbiddenError('Not a channel member');
    }

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgContext.organizationId, userId } }
    });

    if (!targetMembership) {
      throw new BadRequestError('User is not in this organization');
    }

    const member = await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: id, userId } },
      create: { channelId: id, userId },
      update: {}
    });

    return member;
  });

  // Edit Channel Message
  app.put<{ Params: { id: string; messageId: string }; Body: { content: string } }>('/channels/:id/messages/:messageId', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(editChannelMessageSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id: channelId, messageId } = req.params;
    const { content } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, senderId: user.id }
    });

    if (!message) {
      throw new ForbiddenError('Message not found or not yours');
    }

    const mentionedNames = parseMentions(content);
    const mentionedUsers = await findUsersByNames(mentionedNames, orgContext.organizationId);

    const updatedMessage = await prisma.$transaction(async (tx) => {
      await tx.mention.deleteMany({ where: { messageId } });

      return tx.message.update({
        where: { id: messageId },
        data: {
          content,
          isEdited: true,
          mentions: {
            create: mentionedUsers.map((mentionedUser) => ({ userId: mentionedUser.id }))
          }
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

    await prisma.$executeRaw`SELECT pg_notify('channel_events', ${JSON.stringify({
      type: 'UPDATE',
      channelId,
      message: messageWithAggregatedReactions
    })})`;

    return messageWithAggregatedReactions;
  });

  // Delete Channel Message
  app.delete<{ Params: { id: string; messageId: string } }>('/channels/:id/messages/:messageId', {
    preHandler: [validateParams(messageIdParamSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id: channelId, messageId } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, senderId: user.id },
      include: { _count: { select: { replies: true } } }
    });

    if (!message) {
      throw new ForbiddenError('Message not found or not yours');
    }

    if (message._count.replies > 0) {
      const updatedMessage = await prisma.$transaction(async (tx) => {
        await tx.mention.deleteMany({ where: { messageId } });
        await tx.reaction.deleteMany({ where: { messageId } });
        await tx.attachment.deleteMany({ where: { messageId } });

        return tx.message.update({
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

      await prisma.$executeRaw`SELECT pg_notify('channel_events', ${JSON.stringify({
        type: 'UPDATE',
        channelId,
        message: messageWithAggregatedReactions
      })})`;

      return messageWithAggregatedReactions;
    }

    if (message.threadId) {
      await prisma.message.update({
        where: { id: message.threadId },
        data: { replyCount: { decrement: 1 } }
      });
    }

    await prisma.message.delete({ where: { id: messageId } });

    await prisma.$executeRaw`SELECT pg_notify('channel_events', ${JSON.stringify({
      type: 'DELETE',
      channelId,
      messageId
    })})`;

    return { success: true };
  });

  // Toggle Channel Message Reaction
  app.post<{ Params: { id: string; messageId: string }; Body: { emoji: string } }>('/channels/:id/messages/:messageId/reactions', {
    preHandler: [validateParams(messageIdParamSchema), validateBody(reactionSchema), requireOrgResource('channel')]
  }, async (req, res) => {
    const { id: channelId, messageId } = req.params;
    const { emoji } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        channelId,
        channel: { organizationId: orgContext.organizationId }
      }
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const existingReaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId: user.id, emoji }
      }
    });

    if (existingReaction) {
      await prisma.reaction.delete({ where: { id: existingReaction.id } });
    } else {
      await prisma.reaction.create({
        data: { messageId, userId: user.id, emoji }
      });
    }

    const reactions = await prisma.reaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, name: true } } }
    });

    const aggregatedReactions = aggregateReactions(reactions);

    await prisma.$executeRaw`SELECT pg_notify('channel_events', ${JSON.stringify({
      type: 'REACTION',
      channelId,
      messageId,
      reactions: aggregatedReactions
    })})`;

    return { reactions: aggregatedReactions };
  });
}
