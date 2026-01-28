import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization } from '../organization-middleware.js';

export default async function threadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);
  // Get all threads (channels + DMs) where user is participant
  app.get('/threads', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    // Fetch channel internal threads where user is participant (sender or replier)
    const channelThreads = await prisma.message.findMany({
      where: {
        threadId: null, // Only parent messages
        channel: { organizationId: orgContext.organizationId },
        OR: [
          { senderId: user.id },
          { replies: { some: { senderId: user.id } } }
        ],
        replyCount: { gt: 0 } // Must be a thread
      },
      include: {
        sender: true,
        channel: true,
        replies: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Fetch DM threads where user is participant
    const dmThreads = await prisma.dMMessage.findMany({
      where: {
        threadId: null,
        session: { organizationId: orgContext.organizationId },
        OR: [
          { senderId: user.id },
          { replies: { some: { senderId: user.id } } }
        ],
        replyCount: { gt: 0 }
      },
      include: {
        sender: true,
        session: {
          include: {
            participants: {
              include: { user: true }
            }
          }
        },
        replies: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Normalize and merge
    const normalizedChannelThreads = (channelThreads as any[]).map(t => ({
      id: t.id,
      type: 'channel',
      content: t.content,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      replyCount: t.replyCount,
      sender: t.sender,
      location: { id: t.channelId, name: t.channel.name },
      latestReply: t.replies[0]
    }));

    const normalizedDMThreads = (dmThreads as any[]).map(t => {
      const otherParticipant = t.session.participants.find((p: any) => p.userId !== user.id)?.user;
      return {
        id: t.id,
        type: 'dm',
        content: t.content,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replyCount: t.replyCount,
        sender: t.sender,
        location: { id: t.sessionId, name: otherParticipant?.name || otherParticipant?.email || 'Unknown' },
        latestReply: t.replies[0]
      };
    });

    const allThreads = [...normalizedChannelThreads, ...normalizedDMThreads].sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return allThreads;
  });
}
