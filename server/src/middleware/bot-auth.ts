import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import { hashToken } from '../services/bot-token-generator.js';
import { UnauthorizedError } from '../errors/app-errors.js';

export interface BotContext {
  appId: string;
  organizationId: string;
  botUserId: string;
  scopes: string[];
  tokenId: string;
}

// Extend FastifyRequest to include bot context
declare module 'fastify' {
  interface FastifyRequest {
    botContext?: BotContext;
  }
}

/**
 * Middleware to authenticate bot API requests using bot tokens
 *
 * Expects Authorization header in format: "Bearer xoxb-{orgId}-{random}"
 */
export async function requireBotAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  // Extract token from "Bearer {token}" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError('Invalid authorization header format. Expected: Bearer <token>');
  }

  const token = parts[1];

  // Validate token format: xoxb-{orgId}-{random}
  if (!token.startsWith('xoxb-')) {
    throw new UnauthorizedError('Invalid bot token format');
  }

  // Hash the token for database lookup
  const tokenHash = hashToken(token);

  // Look up the token in the database
  const botToken = await prisma.botToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      appId: true,
      organizationId: true,
      isActive: true,
      expiresAt: true,
      app: {
        select: {
          id: true,
          scopes: {
            select: {
              scope: true
            }
          },
          botUsers: {
            where: {
              isActive: true
            },
            select: {
              userId: true
            },
            take: 1
          }
        }
      }
    }
  });

  if (!botToken) {
    throw new UnauthorizedError('Invalid bot token');
  }

  // Check if token is active
  if (!botToken.isActive) {
    throw new UnauthorizedError('Bot token has been revoked');
  }

  // Check if token is expired
  if (botToken.expiresAt && botToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Bot token has expired');
  }

  // Check if the app has an active bot user
  if (!botToken.app.botUsers || botToken.app.botUsers.length === 0) {
    throw new UnauthorizedError('No active bot user found for this app');
  }

  // Update lastUsedAt timestamp (async, don't wait)
  prisma.botToken.update({
    where: { id: botToken.id },
    data: { lastUsedAt: new Date() }
  }).catch((error) => {
    console.error('Failed to update bot token lastUsedAt:', error);
  });

  // Extract scopes
  const scopes = botToken.app.scopes.map(s => s.scope);

  // Attach bot context to request
  req.botContext = {
    appId: botToken.appId,
    organizationId: botToken.organizationId,
    botUserId: botToken.app.botUsers[0].userId,
    scopes,
    tokenId: botToken.id
  };
}

/**
 * Optional bot authentication - does not throw if token is missing,
 * but validates if present
 */
export async function optionalBotAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No auth header, skip authentication
    return;
  }

  // If auth header exists, validate it
  await requireBotAuth(req, reply);
}
