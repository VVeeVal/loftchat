import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireAuthSession } from '../organization-middleware.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../errors/app-errors.js';
import {
  generateClientId,
  generateClientSecret,
  hashToken
} from '../services/bot-token-generator.js';

export default async function appRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', requireAuthSession);

  // List all apps created by the user
  app.get('/apps', async (req, res) => {
    const user = (req as AuthenticatedRequest).user!;

    const apps = await prisma.app.findMany({
      where: { createdBy: user.id },
      include: {
        scopes: true,
        eventSubscriptions: true,
        slashCommands: true,
        installations: {
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            installations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apps.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      clientId: a.clientId,
      iconUrl: a.iconUrl,
      homepageUrl: a.homepageUrl,
      webhookUrl: a.webhookUrl,
      socketModeEnabled: a.socketModeEnabled,
      isPublic: a.isPublic,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      scopes: a.scopes.map((s) => s.scope),
      eventTypes: a.eventSubscriptions.map((e) => e.eventType),
      slashCommands: a.slashCommands.map((c) => ({
        id: c.id,
        command: c.command,
        description: c.description,
        usageHint: c.usageHint
      })),
      installations: a.installations,
      installCount: a._count.installations
    }));
  });

  // Get app details
  app.get<{ Params: { id: string } }>('/apps/:id', async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    const appData = await prisma.app.findUnique({
      where: { id },
      include: {
        scopes: true,
        eventSubscriptions: true,
        slashCommands: true,
        botUsers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        tokens: {
          where: { isActive: true },
          select: {
            id: true,
            organizationId: true,
            isActive: true,
            expiresAt: true,
            lastUsedAt: true,
            createdAt: true
          }
        },
        installations: {
          include: {
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!appData) {
      throw new NotFoundError('App not found');
    }

    // Check ownership
    if (appData.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to access this app');
    }

    return {
      id: appData.id,
      name: appData.name,
      description: appData.description,
      clientId: appData.clientId,
      iconUrl: appData.iconUrl,
      homepageUrl: appData.homepageUrl,
      redirectUrls: appData.redirectUrls,
      webhookUrl: appData.webhookUrl,
      socketModeEnabled: appData.socketModeEnabled,
      isPublic: appData.isPublic,
      createdAt: appData.createdAt,
      updatedAt: appData.updatedAt,
      scopes: appData.scopes.map((s) => s.scope),
      eventTypes: appData.eventSubscriptions.map((e) => e.eventType),
      slashCommands: appData.slashCommands,
      botUsers: appData.botUsers,
      tokens: appData.tokens,
      installations: appData.installations
    };
  });

  // Create new app
  app.post<{
    Body: {
      name: string;
      description?: string;
      iconUrl?: string;
      homepageUrl?: string;
      webhookUrl?: string;
      redirectUrls?: string[];
      socketModeEnabled?: boolean;
      isPublic?: boolean;
    };
  }>('/apps', async (req, res) => {
    const user = (req as AuthenticatedRequest).user!;
    const {
      name,
      description,
      iconUrl,
      homepageUrl,
      webhookUrl,
      redirectUrls,
      socketModeEnabled,
      isPublic
    } = req.body;

    // Generate client credentials
    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const clientSecretHash = hashToken(clientSecret);

    const newApp = await prisma.app.create({
      data: {
        name,
        description,
        iconUrl,
        homepageUrl,
        webhookUrl,
        redirectUrls: redirectUrls || [],
        socketModeEnabled: socketModeEnabled || false,
        isPublic: isPublic || false,
        clientId,
        clientSecret: clientSecretHash,
        createdBy: user.id
      }
    });

    return {
      ...newApp,
      clientSecret // Return plaintext secret only on creation
    };
  });

  // Update app
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      iconUrl?: string;
      homepageUrl?: string;
      webhookUrl?: string;
      redirectUrls?: string[];
      socketModeEnabled?: boolean;
      isPublic?: boolean;
    };
  }>('/apps/:id', async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to update this app');
    }

    const updated = await prisma.app.update({
      where: { id },
      data: req.body
    });

    return updated;
  });

  // Delete app
  app.delete<{ Params: { id: string } }>('/apps/:id', async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to delete this app');
    }

    await prisma.app.delete({ where: { id } });

    return { success: true };
  });

  // Regenerate client secret
  app.post<{ Params: { id: string } }>('/apps/:id/regenerate-secret', async (req, res) => {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to regenerate secret for this app');
    }

    // Generate new secret
    const clientSecret = generateClientSecret();
    const clientSecretHash = hashToken(clientSecret);

    await prisma.app.update({
      where: { id },
      data: { clientSecret: clientSecretHash }
    });

    return { clientSecret };
  });

  // Add scope
  app.post<{
    Params: { id: string };
    Body: { scope: string };
  }>('/apps/:id/scopes', async (req, res) => {
    const { id } = req.params;
    const { scope } = req.body;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    try {
      await prisma.appScope.create({
        data: { appId: id, scope }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Scope already exists');
      }
      throw error;
    }

    return { success: true, scope };
  });

  // Remove scope
  app.delete<{
    Params: { id: string; scope: string };
  }>('/apps/:id/scopes/:scope', async (req, res) => {
    const { id, scope } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    await prisma.appScope.deleteMany({
      where: { appId: id, scope }
    });

    return { success: true };
  });

  // Subscribe to event
  app.post<{
    Params: { id: string };
    Body: { eventType: string };
  }>('/apps/:id/events', async (req, res) => {
    const { id } = req.params;
    const { eventType } = req.body;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    try {
      await prisma.eventSubscription.create({
        data: { appId: id, eventType }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Event subscription already exists');
      }
      throw error;
    }

    return { success: true, eventType };
  });

  // Unsubscribe from event
  app.delete<{
    Params: { id: string; eventType: string };
  }>('/apps/:id/events/:eventType', async (req, res) => {
    const { id, eventType } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    await prisma.eventSubscription.deleteMany({
      where: { appId: id, eventType }
    });

    return { success: true };
  });

  // Create slash command
  app.post<{
    Params: { id: string };
    Body: {
      command: string;
      description: string;
      usageHint?: string;
      requestUrl: string;
    };
  }>('/apps/:id/commands', async (req, res) => {
    const { id } = req.params;
    const { command, description, usageHint, requestUrl } = req.body;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    // Ensure command starts with /
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;

    try {
      const slashCommand = await prisma.slashCommand.create({
        data: {
          appId: id,
          command: normalizedCommand,
          description,
          usageHint,
          requestUrl
        }
      });

      return slashCommand;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Slash command already exists for this app');
      }
      throw error;
    }
  });

  // Update slash command
  app.put<{
    Params: { id: string; commandId: string };
    Body: {
      description?: string;
      usageHint?: string;
      requestUrl?: string;
    };
  }>('/apps/:id/commands/:commandId', async (req, res) => {
    const { id, commandId } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    // Verify command belongs to this app
    const command = await prisma.slashCommand.findFirst({
      where: { id: commandId, appId: id }
    });

    if (!command) {
      throw new NotFoundError('Slash command not found');
    }

    const updated = await prisma.slashCommand.update({
      where: { id: commandId },
      data: req.body
    });

    return updated;
  });

  // Delete slash command
  app.delete<{
    Params: { id: string; commandId: string };
  }>('/apps/:id/commands/:commandId', async (req, res) => {
    const { id, commandId } = req.params;
    const user = (req as AuthenticatedRequest).user!;

    // Check ownership
    const existing = await prisma.app.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('App not found');
    }

    if (existing.createdBy !== user.id) {
      throw new ForbiddenError('Not authorized to modify this app');
    }

    // Verify command belongs to this app
    const command = await prisma.slashCommand.findFirst({
      where: { id: commandId, appId: id }
    });

    if (!command) {
      throw new NotFoundError('Slash command not found');
    }

    await prisma.slashCommand.delete({ where: { id: commandId } });

    return { success: true };
  });
}
