import Fastify, { FastifyInstance, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { auth } from './auth.js';
import { prisma } from './db.js';
import { convertFastifyHeaders } from './utils.js';
import { config } from './config/index.js';
import errorHandler from './plugins/error-handler.js';
import { AppError, BadRequestError, ConflictError, ForbiddenError, InternalServerError } from './errors/app-errors.js';
import { requireAuthSession } from './organization-middleware.js';

const applyAuthResponse = async (reply: FastifyReply, response: Response) => {
  reply.status(response.status);

  const getSetCookie = (response.headers as any).getSetCookie as undefined | (() => string[]);
  const setCookieValues = getSetCookie ? getSetCookie.call(response.headers) : [];
  if (setCookieValues && setCookieValues.length > 0) {
    reply.header('set-cookie', setCookieValues);
  } else {
    const fallback = response.headers.get('set-cookie');
    if (fallback) {
      reply.header('set-cookie', fallback);
    }
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    reply.header(key, value);
  });
};

const getAllowedCorsOrigins = () => new Set(config.corsAllowedOrigins.map((origin) => new URL(origin).origin));

const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) {
    return true;
  }

  return getAllowedCorsOrigins().has(origin);
};

type RegistrationLinkContext = {
  id: string;
  organizationId: string;
  usageLimit: number | null;
  usageCount: number;
};

const getRegistrationLink = async (token?: string | null): Promise<RegistrationLinkContext | null> => {
  if (!token) {
    return null;
  }

  const registrationLink = await prisma.registrationLink.findFirst({
    where: {
      token,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    select: {
      id: true,
      organizationId: true,
      usageLimit: true,
      usageCount: true
    }
  });

  if (!registrationLink) {
    throw new BadRequestError('Invalid or expired registration link');
  }

  if (registrationLink.usageLimit !== null && registrationLink.usageCount >= registrationLink.usageLimit) {
    throw new BadRequestError('Invalid or expired registration link');
  }

  return registrationLink;
};

const linkUserToRegistrationOrganization = async (userId: string, sessionId: string, token: string) => {
  const registrationLink = await getRegistrationLink(token);
  if (!registrationLink) {
    return { joined: false };
  }

  const existingMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: registrationLink.organizationId,
        userId,
      },
    },
  });

  if (!existingMembership) {
    await prisma.organizationMember.create({
      data: {
        organizationId: registrationLink.organizationId,
        userId,
        role: 'MEMBER',
      }
    });

    const nextUsageCount = registrationLink.usageCount + 1;
    const shouldMarkUsed =
      registrationLink.usageLimit !== null && nextUsageCount >= registrationLink.usageLimit;

    await prisma.registrationLink.update({
      where: { id: registrationLink.id },
      data: {
        usageCount: nextUsageCount,
        isUsed: shouldMarkUsed
      }
    });

    const org = await prisma.organization.findUnique({
      where: { id: registrationLink.organizationId },
      select: { name: true }
    });

    const dmSession = await prisma.dMSession.create({
      data: {
        organizationId: registrationLink.organizationId,
        participants: {
          create: [
            { userId: 'system', lastReadAt: new Date() },
            { userId, lastReadAt: new Date(0) }
          ]
        }
      }
    });

    await prisma.dMMessage.create({
      data: {
        content: `Welcome to ${org?.name || 'the workspace'}! 👋\n\nHere are some tips to get started:\n• Check out the **#general** channel to introduce yourself\n• Use the sidebar to browse channels and direct messages\n• Click on a user's name to start a conversation\n\nIf you have any questions, feel free to reach out!`,
        sessionId: dmSession.id,
        senderId: 'system'
      }
    });
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: registrationLink.organizationId }
  });

  return {
    joined: !existingMembership,
    organizationId: registrationLink.organizationId,
    alreadyMember: Boolean(existingMembership),
  };
};

const bootstrapOrganizationForFirstUser = async (userId: string, sessionId: string, organizationName: string) => {
  const trimmedOrganizationName = organizationName.trim();
  if (!trimmedOrganizationName) {
    throw new BadRequestError('Organization name is required');
  }

  const userCount = await prisma.user.count({
    where: { email: { not: 'system@loft.chat' } }
  });

  if (userCount !== 1) {
    throw new BadRequestError('Workspace has already been initialized');
  }

  const existingMembership = await prisma.organizationMember.findFirst({
    where: { userId }
  });

  if (existingMembership) {
    return {
      created: false,
      organizationId: existingMembership.organizationId,
      alreadyInitialized: true,
    };
  }

  let createdOrganization: { id: string } | null = null;

  try {
    createdOrganization = await prisma.organization.create({
      data: {
        name: trimmedOrganizationName,
      }
    });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      throw new ConflictError(
        `Organization name "${trimmedOrganizationName}" is already taken. Please choose a different name.`
      );
    }
    throw error;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: true }
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: createdOrganization.id,
      userId,
      role: 'ADMIN',
    }
  });

  await prisma.channel.create({
    data: {
      name: 'general',
      description: 'General discussion',
      createdBy: userId,
      organizationId: createdOrganization.id,
      isPrivate: false
    }
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: createdOrganization.id }
  });

  return {
    created: true,
    organizationId: createdOrganization.id,
    alreadyInitialized: false,
  };
};

export async function buildApp(): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  await app.register(cookie);
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadSizeBytes }
  });
  if (config.storageBackend === 'local') {
    await fs.promises.mkdir(path.join(process.cwd(), config.uploadDir), { recursive: true });
    await app.register(fastifyStatic, {
      root: path.join(process.cwd(), config.uploadDir),
      prefix: '/uploads/',
    });
  }

  await app.register(errorHandler);

  app.addHook('onRequest', async (req, res) => {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutating.includes(req.method)) return;
    const originHeader = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (!originHeader) return;
    if (!isAllowedOrigin(originHeader)) {
      throw new ForbiddenError('Invalid request origin');
    }
  });

  // Auth status endpoint (check if workspace is initialized)
  app.get("/api/auth/status", async (req, res) => {
    try {
      const userCount = await prisma.user.count({
        where: {
          email: { not: 'system@loft.chat' } // Exclude system user
        }
      });
      return {
        hasUsers: userCount > 0,
        googleOAuthEnabled: config.googleOAuthEnabled,
      };
    } catch (error) {
      app.log.error(error);
      throw new InternalServerError('Failed to check status');
    }
  });

  // Specific sign-up handler BEFORE the catch-all
  app.post<{ Body: { email: string; password: string; name: string; organizationName?: string; token?: string } }>(
    "/api/auth/sign-up",
    async (req, res) => {
      try {
        const body = req.body;

        const userCount = await prisma.user.count({
          where: { email: { not: 'system@loft.chat' } }
        });

        const isFirstUser = userCount === 0;
        let createdOrganization: { id: string } | null = null;
        let registrationLink: RegistrationLinkContext | null = null;

        // If there's a registration token, validate it
        registrationLink = await getRegistrationLink(body.token);

        // If first user and has org name, create organization
        if (isFirstUser && body.organizationName) {
          try {
            createdOrganization = await prisma.organization.create({
              data: {
                name: body.organizationName,
              }
            });
            app.log.info('Organization created:', body.organizationName);
          } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
              throw new ConflictError(
                `Organization name "${body.organizationName}" is already taken. Please choose a different name.`
              );
            }
            throw error;
          }
        }

        // Forward to BetterAuth - use /sign-up/email for email/password auth
        const betterAuthUrl = new URL('/api/auth/sign-up/email', config.betterAuthUrl);
        const headers = convertFastifyHeaders(req.headers);

        const authBody = {
          email: body.email,
          password: body.password,
          name: body.name,
        };

        const request = new Request(betterAuthUrl.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify(authBody)
        });

        const response = await auth.handler(request);

        // If BetterAuth succeeded and we created an organization, link the user to it
        if (response.ok && createdOrganization) {
          try {
            // Find the newly created user
            const newUser = await prisma.user.findUnique({
              where: { email: body.email }
            });

            if (newUser) {
              // Mark the first user as admin
              await prisma.user.update({
                where: { id: newUser.id },
                data: { isAdmin: true }
              });
              app.log.info('User marked as admin');

              // Create organization membership as ADMIN
              await prisma.organizationMember.create({
                data: {
                  organizationId: createdOrganization.id,
                  userId: newUser.id,
                  role: 'ADMIN',
                }
              });
              app.log.info('User linked to organization as ADMIN');

              // Create a general channel for the new organization
              await prisma.channel.create({
                data: {
                  name: 'general',
                  description: 'General discussion',
                  createdBy: newUser.id,
                  organizationId: createdOrganization.id,
                  isPrivate: false
                }
              });
              app.log.info('General channel created for organization');

              // Find and update the session with activeOrganizationId
              const session = await prisma.session.findFirst({
                where: { userId: newUser.id },
                orderBy: { createdAt: 'desc' }
              });

              if (session) {
                await prisma.session.update({
                  where: { id: session.id },
                  data: { activeOrganizationId: createdOrganization.id }
                });
                app.log.info('Session updated with activeOrganizationId');
              }
            }
          } catch (linkError) {
            app.log.error('Failed to link user to organization:', linkError);
            // Don't fail the registration, user can be linked later
          }
        }

        // If BetterAuth succeeded and we have a registration link, link user to that organization
        if (response.ok && registrationLink) {
          try {
            // Wait for user to be available in database (BetterAuth might be async)
            let newUser = null;
            for (let i = 0; i < 5; i++) {
              newUser = await prisma.user.findUnique({
                where: { email: body.email }
              });
              if (newUser) break;
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!newUser) {
              app.log.error('User not found after registration, email:', body.email);
              throw new Error('User not found after registration');
            }

            app.log.info('Found new user for registration link:', newUser.id);

            // Create organization membership as MEMBER
            await prisma.organizationMember.create({
              data: {
                organizationId: registrationLink.organizationId,
                userId: newUser.id,
                role: 'MEMBER',
              }
            });
            app.log.info('User linked to organization via registration link');

            const nextUsageCount = registrationLink.usageCount + 1;
            const shouldMarkUsed = registrationLink.usageLimit !== null && nextUsageCount >= registrationLink.usageLimit;

            await prisma.registrationLink.update({
              where: { id: registrationLink.id },
              data: {
                usageCount: nextUsageCount,
                isUsed: shouldMarkUsed
              }
            });
            app.log.info('Registration link usage incremented');

            // Find and update the session with activeOrganizationId
            const session = await prisma.session.findFirst({
              where: { userId: newUser.id },
              orderBy: { createdAt: 'desc' }
            });

            if (session) {
              await prisma.session.update({
                where: { id: session.id },
                data: { activeOrganizationId: registrationLink.organizationId }
              });
              app.log.info('Session updated with activeOrganizationId');
            } else {
              app.log.warn('Session not found for user:', newUser.id);
            }

            // Get organization name for welcome message
            const org = await prisma.organization.findUnique({
              where: { id: registrationLink.organizationId }
            });

            // Send welcome message from system
            const dmSession = await prisma.dMSession.create({
              data: {
                organizationId: registrationLink.organizationId,
                participants: {
                  create: [
                    { userId: 'system', lastReadAt: new Date() },
                    { userId: newUser.id, lastReadAt: new Date(0) }
                  ]
                }
              }
            });

            await prisma.dMMessage.create({
              data: {
                content: `Welcome to ${org?.name || 'the workspace'}! 👋\n\nHere are some tips to get started:\n• Check out the **#general** channel to introduce yourself\n• Use the sidebar to browse channels and direct messages\n• Click on a user's name to start a conversation\n\nIf you have any questions, feel free to reach out!`,
                sessionId: dmSession.id,
                senderId: 'system'
              }
            });
            app.log.info('Welcome message sent to new user');
          } catch (linkError) {
            app.log.error('Failed to link user to organization via registration link:', linkError);
            // Don't fail the registration
          }
        }

        const responseBody = response.body ? await response.text() : null;
        await applyAuthResponse(res, response);
        return res.send(responseBody);
      } catch (error) {
        app.log.error('Sign-up error:', error);
        if (error instanceof AppError) {
          throw error;
        }
        throw new InternalServerError('Registration failed');
      }
    }
  );

  app.post<{ Body: { token?: string; organizationName?: string } }>(
    "/api/auth/oauth/finalize",
    async (req, res) => {
      try {
        const sessionData = await requireAuthSession(req, res);
        const token = req.body?.token;
        const organizationName = req.body?.organizationName;

        if (!token) {
          if (organizationName) {
            const result = await bootstrapOrganizationForFirstUser(
              sessionData.user.id,
              sessionData.session.id,
              organizationName
            );

            return {
              success: true,
              joined: false,
              ...result,
            };
          }

          return { success: true, joined: false };
        }

        const result = await linkUserToRegistrationOrganization(
          sessionData.user.id,
          sessionData.session.id,
          token
        );

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        app.log.error('OAuth finalize error:', error);
        if (error instanceof AppError) {
          throw error;
        }
        throw new InternalServerError('Failed to finalize OAuth sign-in');
      }
    }
  );

  // BetterAuth handler for all other auth routes
  app.all("/api/auth/*", async (req, res) => {
    const url = new URL(req.url, config.betterAuthUrl);
    const headers = convertFastifyHeaders(req.headers);
    const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : JSON.stringify(req.body);

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body
    });

    const response = await auth.handler(request);

    const responseBody = response.body ? await response.text() : null;
    await applyAuthResponse(res, response);
    return res.send(responseBody);
  });

  // App Routes
  app.register(import('./organization-routes.js'), { prefix: '/api' });

  // Core feature routes (split from routes.js)
  app.register(import('./routes/threads.js'), { prefix: '/api' });
  app.register(import('./routes/channels.js'), { prefix: '/api' });
  app.register(import('./routes/dms.js'), { prefix: '/api' });
  app.register(import('./routes/users.js'), { prefix: '/api' });
  app.register(import('./routes/uploads.js'), { prefix: '/api' });
  app.register(import('./routes/storage.js'), { prefix: '/api' });
  app.register(import('./routes/bookmarks.js'), { prefix: '/api' });
  app.register(import('./routes/emoji.js'), { prefix: '/api' });
  app.register(import('./routes/search.js'), { prefix: '/api' });
  app.register(import('./routes/apps.js'), { prefix: '/api' });
  app.register(import('./routes/slash-commands.js'), { prefix: '/api' });
  app.register(import('./routes/bot-api.js'), { prefix: '/api/bot' });
  app.register(import('./routes/work-units.js'), { prefix: '/api' });

  app.register(import('./registration-links.js'), { prefix: '/api' });
  app.register(import('./user-management.js'), { prefix: '/api/users' });
  app.register(import('./realtime.js'), { prefix: '/api' }); // /api/ws

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
