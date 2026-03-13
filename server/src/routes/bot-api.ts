import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireBotAuth } from '../middleware/bot-auth.js';
import { requireBotScopes } from '../middleware/bot-scopes.js';
import { botRateLimiter, RateLimitTier } from '../middleware/rate-limiter.js';
import { BadRequestError, NotFoundError } from '../errors/app-errors.js';
import {
  formatMessage,
  formatDMMessage,
  formatChannel,
  formatUser,
  formatSuccess,
  formatError,
  toSlackTimestamp,
  fromSlackTimestamp
} from '../utils/slack-formatter.js';
import { eventPublisher } from '../services/event-publisher.js';
import {
  createMessageChannelsEvent,
  createMessageIMEvent,
  createReactionAddedEvent,
  createReactionRemovedEvent
} from '../utils/event-mapper.js';

/**
 * Slack-compatible Bot Web API routes
 * Implements key endpoints from Slack's API
 */
export default async function botApiRoutes(app: FastifyInstance) {
  // All routes require bot authentication
  app.addHook('preHandler', requireBotAuth);

  // ===== chat.postMessage =====
  app.post<{
    Body: {
      channel: string;
      text: string;
      thread_ts?: string;
      as_user?: boolean;
    };
  }>('/chat.postMessage', {
    preHandler: [
      requireBotScopes('chat:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, text, thread_ts } = req.body;
    const botContext = req.botContext!;

    // Find the channel
    const channelData = await prisma.channel.findFirst({
      where: {
        id: channel,
        organizationId: botContext.organizationId
      }
    });

    if (!channelData) {
      return formatError('channel_not_found');
    }

    // Parse thread_ts if provided
    let threadId: string | undefined;
    if (thread_ts) {
      const threadTimestamp = fromSlackTimestamp(thread_ts);
      const threadMessage = await prisma.message.findFirst({
        where: {
          channelId: channel,
          createdAt: threadTimestamp
        }
      });
      threadId = threadMessage?.id;
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: text,
        channelId: channel,
        senderId: botContext.botUserId,
        threadId
      },
      include: {
        sender: true,
        attachments: true,
        reactions: true
      }
    });

    // Publish event
    const event = createMessageChannelsEvent(
      message,
      botContext.organizationId,
      botContext.appId
    );
    eventPublisher.publishEvent(
      botContext.organizationId,
      'message.channels',
      event
    ).catch((error) => {
      console.error('Failed to publish message event:', error);
    });

    return formatSuccess({
      channel,
      ts: toSlackTimestamp(message.createdAt),
      message: formatMessage(message)
    });
  });

  // ===== chat.update =====
  app.post<{
    Body: {
      channel: string;
      ts: string;
      text: string;
    };
  }>('/chat.update', {
    preHandler: [
      requireBotScopes('chat:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, ts, text } = req.body;
    const botContext = req.botContext!;

    const messageTimestamp = fromSlackTimestamp(ts);

    // Find the message
    const message = await prisma.message.findFirst({
      where: {
        channelId: channel,
        createdAt: messageTimestamp,
        senderId: botContext.botUserId
      }
    });

    if (!message) {
      return formatError('message_not_found');
    }

    // Update the message
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        content: text,
        isEdited: true
      },
      include: {
        sender: true,
        attachments: true,
        reactions: true
      }
    });

    return formatSuccess({
      channel,
      ts: toSlackTimestamp(updated.createdAt),
      text,
      message: formatMessage(updated)
    });
  });

  // ===== chat.delete =====
  app.post<{
    Body: {
      channel: string;
      ts: string;
    };
  }>('/chat.delete', {
    preHandler: [
      requireBotScopes('chat:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, ts } = req.body;
    const botContext = req.botContext!;

    const messageTimestamp = fromSlackTimestamp(ts);

    // Find the message
    const message = await prisma.message.findFirst({
      where: {
        channelId: channel,
        createdAt: messageTimestamp,
        senderId: botContext.botUserId
      }
    });

    if (!message) {
      return formatError('message_not_found');
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: message.id }
    });

    return formatSuccess({
      channel,
      ts
    });
  });

  // ===== conversations.history =====
  app.get<{
    Querystring: {
      channel: string;
      cursor?: string;
      limit?: string;
      oldest?: string;
      latest?: string;
    };
  }>('/conversations.history', {
    preHandler: [
      requireBotScopes('channels:history'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, cursor, limit = '100', oldest, latest } = req.query;
    const botContext = req.botContext!;

    const limitNum = Math.min(parseInt(limit), 200);

    const where: any = {
      channelId: channel,
      channel: {
        organizationId: botContext.organizationId
      }
    };

    // Add timestamp filters
    if (oldest) {
      where.createdAt = { ...where.createdAt, gte: fromSlackTimestamp(oldest) };
    }
    if (latest) {
      where.createdAt = { ...where.createdAt, lte: fromSlackTimestamp(latest) };
    }

    // Cursor pagination
    if (cursor) {
      where.id = { lt: cursor };
    }

    const messages = await prisma.message.findMany({
      where,
      take: limitNum + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: true,
        attachments: true,
        reactions: true
      }
    });

    const hasMore = messages.length > limitNum;
    const results = hasMore ? messages.slice(0, limitNum) : messages;

    return formatSuccess({
      messages: results.map(formatMessage),
      has_more: hasMore,
      response_metadata: hasMore
        ? {
            next_cursor: results[results.length - 1].id
          }
        : {}
    });
  });

  // ===== conversations.list =====
  app.get<{
    Querystring: {
      cursor?: string;
      limit?: string;
      exclude_archived?: string;
      types?: string;
    };
  }>('/conversations.list', {
    preHandler: [
      requireBotScopes('channels:read'),
      botRateLimiter(RateLimitTier.TIER_2)
    ]
  }, async (req, res) => {
    const { cursor, limit = '100', exclude_archived = 'false' } = req.query;
    const botContext = req.botContext!;

    const limitNum = Math.min(parseInt(limit), 200);

    const where: any = {
      organizationId: botContext.organizationId
    };

    if (exclude_archived === 'true') {
      where.isArchived = false;
    }

    if (cursor) {
      where.id = { gt: cursor };
    }

    const channels = await prisma.channel.findMany({
      where,
      take: limitNum + 1,
      orderBy: { createdAt: 'asc' },
      include: {
        members: true
      }
    });

    const hasMore = channels.length > limitNum;
    const results = hasMore ? channels.slice(0, limitNum) : channels;

    return formatSuccess({
      channels: results.map(formatChannel),
      response_metadata: hasMore
        ? {
            next_cursor: results[results.length - 1].id
          }
        : {}
    });
  });

  // ===== conversations.join =====
  app.post<{
    Body: {
      channel: string;
    };
  }>('/conversations.join', {
    preHandler: [
      requireBotScopes('channels:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel } = req.body;
    const botContext = req.botContext!;

    // Find the channel
    const channelData = await prisma.channel.findFirst({
      where: {
        id: channel,
        organizationId: botContext.organizationId
      }
    });

    if (!channelData) {
      return formatError('channel_not_found');
    }

    if (channelData.isPrivate) {
      return formatError('is_private');
    }

    // Check if already a member
    const existingMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: channel,
          userId: botContext.botUserId
        }
      }
    });

    if (!existingMember) {
      // Join the channel
      await prisma.channelMember.create({
        data: {
          channelId: channel,
          userId: botContext.botUserId,
          role: 'MEMBER'
        }
      });
    }

    return formatSuccess({
      channel: formatChannel(channelData)
    });
  });

  // ===== users.info =====
  app.get<{
    Querystring: {
      user: string;
    };
  }>('/users.info', {
    preHandler: [
      requireBotScopes('users:read'),
      botRateLimiter(RateLimitTier.TIER_4)
    ]
  }, async (req, res) => {
    const { user } = req.query;
    const botContext = req.botContext!;

    const userData = await prisma.user.findFirst({
      where: {
        id: user,
        organizationMemberships: {
          some: {
            organizationId: botContext.organizationId
          }
        }
      }
    });

    if (!userData) {
      return formatError('user_not_found');
    }

    return formatSuccess({
      user: formatUser(userData)
    });
  });

  // ===== users.list =====
  app.get<{
    Querystring: {
      cursor?: string;
      limit?: string;
    };
  }>('/users.list', {
    preHandler: [
      requireBotScopes('users:read'),
      botRateLimiter(RateLimitTier.TIER_2)
    ]
  }, async (req, res) => {
    const { cursor, limit = '100' } = req.query;
    const botContext = req.botContext!;

    const limitNum = Math.min(parseInt(limit), 200);

    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: botContext.organizationId
      },
      take: limitNum + 1,
      include: {
        user: true
      },
      orderBy: { joinedAt: 'asc' }
    });

    const hasMore = members.length > limitNum;
    const results = hasMore ? members.slice(0, limitNum) : members;

    return formatSuccess({
      members: results.map((m) => formatUser(m.user)),
      response_metadata: hasMore
        ? {
            next_cursor: results[results.length - 1].id
          }
        : {}
    });
  });

  // ===== reactions.add =====
  app.post<{
    Body: {
      channel: string;
      timestamp: string;
      name: string;
    };
  }>('/reactions.add', {
    preHandler: [
      requireBotScopes('reactions:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, timestamp, name } = req.body;
    const botContext = req.botContext!;

    const messageTimestamp = fromSlackTimestamp(timestamp);

    // Find the message
    const message = await prisma.message.findFirst({
      where: {
        channelId: channel,
        createdAt: messageTimestamp
      }
    });

    if (!message) {
      return formatError('message_not_found');
    }

    // Add reaction
    try {
      const reaction = await prisma.reaction.create({
        data: {
          messageId: message.id,
          userId: botContext.botUserId,
          emoji: name
        }
      });

      // Publish event
      const event = createReactionAddedEvent(
        reaction,
        message,
        botContext.organizationId,
        botContext.appId
      );
      eventPublisher.publishEvent(
        botContext.organizationId,
        'reaction_added',
        event
      ).catch((error) => {
        console.error('Failed to publish reaction event:', error);
      });

      return formatSuccess({});
    } catch (error: any) {
      if (error.code === 'P2002') {
        return formatError('already_reacted');
      }
      throw error;
    }
  });

  // ===== reactions.remove =====
  app.post<{
    Body: {
      channel: string;
      timestamp: string;
      name: string;
    };
  }>('/reactions.remove', {
    preHandler: [
      requireBotScopes('reactions:write'),
      botRateLimiter(RateLimitTier.TIER_3)
    ]
  }, async (req, res) => {
    const { channel, timestamp, name } = req.body;
    const botContext = req.botContext!;

    const messageTimestamp = fromSlackTimestamp(timestamp);

    // Find the message
    const message = await prisma.message.findFirst({
      where: {
        channelId: channel,
        createdAt: messageTimestamp
      }
    });

    if (!message) {
      return formatError('message_not_found');
    }

    // Remove reaction
    const deleted = await prisma.reaction.deleteMany({
      where: {
        messageId: message.id,
        userId: botContext.botUserId,
        emoji: name
      }
    });

    if (deleted.count === 0) {
      return formatError('no_reaction');
    }

    return formatSuccess({});
  });
}
