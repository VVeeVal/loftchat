import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization } from '../organization-middleware.js';
import { ValidationError } from '../errors/app-errors.js';

const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  type: z.enum(['all', 'channels', 'users', 'messages']).optional(),
  limit: z.coerce.number().min(1).max(50).optional()
});

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  app.get('/search', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors, 'Invalid query');
    }

    const { q, type = 'all', limit = 20 } = parsed.data;
    const query = q.trim();
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    if (!query) {
      return { query: q, channels: [], users: [], messages: [] };
    }

    const shouldSearchChannels = type === 'all' || type === 'channels';
    const shouldSearchUsers = type === 'all' || type === 'users';
    const shouldSearchMessages = type === 'all' || type === 'messages';

    const channelsPromise = shouldSearchChannels
      ? prisma.channel.findMany({
          where: {
            organizationId: orgContext.organizationId,
            OR: [
              { isPrivate: false },
              { members: { some: { userId: user.id } } },
              { createdBy: user.id }
            ],
            AND: [
              {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { description: { contains: query, mode: 'insensitive' } }
                ]
              }
            ]
          },
          select: { id: true, name: true, description: true, isPrivate: true },
          take: limit
        })
      : Promise.resolve([]);

    const usersPromise = shouldSearchUsers
      ? prisma.user.findMany({
          where: {
            organizationMemberships: {
              some: { organizationId: orgContext.organizationId }
            },
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          },
          select: { id: true, name: true, email: true, image: true, bio: true },
          take: limit
        })
      : Promise.resolve([]);

    const messagesPromise = shouldSearchMessages
      ? Promise.all([
          prisma.message.findMany({
            where: {
              content: { contains: query, mode: 'insensitive' },
              channel: {
                organizationId: orgContext.organizationId,
                OR: [
                  { isPrivate: false },
                  { members: { some: { userId: user.id } } },
                  { createdBy: user.id }
                ]
              }
            },
            select: {
              id: true,
              content: true,
              createdAt: true,
              threadId: true,
              channel: { select: { id: true, name: true, isPrivate: true } },
              sender: { select: { id: true, name: true, email: true, image: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
          }),
          prisma.dMMessage.findMany({
            where: {
              content: { contains: query, mode: 'insensitive' },
              session: {
                organizationId: orgContext.organizationId,
                participants: { some: { userId: user.id } }
              }
            },
            select: {
              id: true,
              content: true,
              createdAt: true,
              threadId: true,
              session: {
                select: {
                  id: true,
                  participants: {
                    select: {
                      userId: true,
                      user: { select: { id: true, name: true, email: true, image: true } }
                    }
                  }
                }
              },
              sender: { select: { id: true, name: true, email: true, image: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
          })
        ])
      : Promise.resolve([[], []]);

    const [channels, users, messageResults] = await Promise.all([
      channelsPromise,
      usersPromise,
      messagesPromise
    ]);

    const [channelMessages, dmMessages] = messageResults as [
      Array<{
        id: string;
        content: string;
        createdAt: Date;
        threadId: string | null;
        channel: { id: string; name: string; isPrivate: boolean };
        sender: { id: string; name: string | null; email: string; image: string | null };
      }>,
      Array<{
        id: string;
        content: string;
        createdAt: Date;
        threadId: string | null;
        session: {
          id: string;
          participants: Array<{
            userId: string;
            user: { id: string; name: string | null; email: string; image: string | null };
          }>;
        };
        sender: { id: string; name: string | null; email: string; image: string | null };
      }>
    ];

    const messages = shouldSearchMessages
      ? [
          ...channelMessages.map((message) => ({
            ...message,
            type: 'channel' as const
          })),
          ...dmMessages.map((message) => ({
            ...message,
            type: 'dm' as const
          }))
        ]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, limit)
      : [];

    return {
      query,
      channels,
      users,
      messages
    };
  });
}
