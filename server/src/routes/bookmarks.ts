import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization } from '../organization-middleware.js';
import { validateBody } from '../plugins/validator.js';
import { createBookmarkSchema } from '../schemas/bookmark.schemas.js';
import { ForbiddenError, NotFoundError } from '../errors/app-errors.js';

export default async function bookmarkRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  // List Bookmarks
  app.get('/bookmarks', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          include: {
            channel: true,
            sender: { select: { id: true, name: true, email: true, image: true } }
          }
        },
        dmMessage: {
          include: {
            session: {
              include: {
                participants: {
                  include: { user: { select: { id: true, name: true, email: true, image: true } } }
                }
              }
            },
            sender: { select: { id: true, name: true, email: true, image: true } }
          }
        }
      }
    });

    const filtered = bookmarks.filter((bookmark) => {
      if (bookmark.message) {
        return bookmark.message.channel.organizationId === orgContext.organizationId;
      }
      if (bookmark.dmMessage) {
        return bookmark.dmMessage.session.organizationId === orgContext.organizationId;
      }
      return false;
    });

    return filtered;
  });

  // Toggle Bookmark
  app.post<{ Body: { messageId?: string; dmMessageId?: string } }>('/bookmarks', {
    preHandler: [validateBody(createBookmarkSchema)]
  }, async (req, res) => {
    const { messageId, dmMessageId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    if (messageId) {
      const message = await prisma.message.findFirst({
        where: { id: messageId, channel: { organizationId: orgContext.organizationId } },
        include: {
          channel: {
            include: {
              members: { where: { userId: user.id } }
            }
          }
        }
      });

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      if (message.channel.isPrivate && message.channel.createdBy !== user.id && message.channel.members.length === 0) {
        throw new ForbiddenError('No access to this channel');
      }

      const existing = await prisma.bookmark.findFirst({
        where: { userId: user.id, messageId }
      });

      if (existing) {
        await prisma.bookmark.delete({ where: { id: existing.id } });
        return { bookmarked: false };
      }

      const bookmark = await prisma.bookmark.create({
        data: { userId: user.id, messageId }
      });

      return { bookmarked: true, bookmark };
    }

    if (dmMessageId) {
      const message = await prisma.dMMessage.findFirst({
        where: {
          id: dmMessageId,
          session: {
            organizationId: orgContext.organizationId,
            participants: { some: { userId: user.id } }
          }
        }
      });

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      const existing = await prisma.bookmark.findFirst({
        where: { userId: user.id, dmMessageId }
      });

      if (existing) {
        await prisma.bookmark.delete({ where: { id: existing.id } });
        return { bookmarked: false };
      }

      const bookmark = await prisma.bookmark.create({
        data: { userId: user.id, dmMessageId }
      });

      return { bookmarked: true, bookmark };
    }

    throw new NotFoundError('Message not found');
  });
}
