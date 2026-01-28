import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization, requireOrganizationAdmin } from '../organization-middleware.js';
import { validateBody, validateParams } from '../plugins/validator.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { createCustomEmojiSchema, updateCustomEmojiSchema } from '../schemas/emoji.schemas.js';
import { ConflictError, NotFoundError } from '../errors/app-errors.js';

export default async function emojiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);

  const normalizeEmojiUrl = (imageUrl: string) => {
    if (!imageUrl) return imageUrl;
    if (imageUrl.startsWith('/')) return imageUrl;
    try {
      const parsed = new URL(imageUrl);
      const uploadIndex = parsed.pathname.indexOf('/uploads/');
      if (uploadIndex >= 0) {
        return parsed.pathname.slice(uploadIndex);
      }
    } catch {
      // ignore invalid URLs and return original
    }
    return imageUrl;
  };

  app.get('/emoji', async (req, res) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const emoji = await prisma.customEmoji.findMany({
      where: { organizationId: orgContext.organizationId },
      orderBy: { name: 'asc' }
    });
    return emoji.map((entry) => ({ ...entry, imageUrl: normalizeEmojiUrl(entry.imageUrl) }));
  });

  app.post<{ Body: { name: string; imageUrl: string } }>('/emoji', {
    preHandler: [requireOrganizationAdmin, validateBody(createCustomEmojiSchema)]
  }, async (req, res) => {
    const { name, imageUrl } = req.body;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    try {
      const emoji = await prisma.customEmoji.create({
        data: { name, imageUrl, organizationId: orgContext.organizationId }
      });
      return { ...emoji, imageUrl: normalizeEmojiUrl(emoji.imageUrl) };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Custom emoji name already exists');
      }
      throw error;
    }
  });

  app.put<{ Params: { id: string }; Body: { name?: string; imageUrl?: string } }>('/emoji/:id', {
    preHandler: [requireOrganizationAdmin, validateParams(idParamSchema), validateBody(updateCustomEmojiSchema)]
  }, async (req, res) => {
    const { id } = req.params;
    const { name, imageUrl } = req.body;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const existing = await prisma.customEmoji.findFirst({
      where: { id, organizationId: orgContext.organizationId }
    });

    if (!existing) {
      throw new NotFoundError('Custom emoji not found');
    }

    const updated = await prisma.customEmoji.update({
      where: { id },
      data: { name, imageUrl }
    });

    return { ...updated, imageUrl: normalizeEmojiUrl(updated.imageUrl) };
  });

  app.delete<{ Params: { id: string } }>('/emoji/:id', {
    preHandler: [requireOrganizationAdmin, validateParams(idParamSchema)]
  }, async (req, res) => {
    const { id } = req.params;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const existing = await prisma.customEmoji.findFirst({
      where: { id, organizationId: orgContext.organizationId }
    });

    if (!existing) {
      throw new NotFoundError('Custom emoji not found');
    }

    await prisma.customEmoji.delete({ where: { id } });
    return { success: true };
  });
}
