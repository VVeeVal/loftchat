import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/app-errors.js';

/**
 * Middleware factory to check if bot has required OAuth scopes
 *
 * @param requiredScopes - Array of scopes that the bot must have
 * @returns Middleware function
 *
 * @example
 * // Require chat:write scope
 * fastify.get('/api/bot/chat.postMessage',
 *   { preHandler: [requireBotAuth, requireBotScopes('chat:write')] },
 *   handler
 * );
 *
 * @example
 * // Require multiple scopes
 * fastify.get('/api/bot/files.upload',
 *   { preHandler: [requireBotAuth, requireBotScopes('files:write', 'chat:write')] },
 *   handler
 * );
 */
export function requireBotScopes(...requiredScopes: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ensure bot context exists (should be set by requireBotAuth middleware)
    if (!req.botContext) {
      throw new UnauthorizedError('Bot authentication required');
    }

    const { scopes } = req.botContext;

    // Check if bot has all required scopes
    const missingScopes = requiredScopes.filter(
      (required) => !scopes.includes(required)
    );

    if (missingScopes.length > 0) {
      throw new ForbiddenError(
        `Missing required scopes: ${missingScopes.join(', ')}`
      );
    }
  };
}

/**
 * Middleware to check if bot has at least one of the specified scopes
 *
 * @param allowedScopes - Array of scopes (bot needs at least one)
 * @returns Middleware function
 *
 * @example
 * // Require either channels:read or channels:write
 * fastify.get('/api/bot/conversations.list',
 *   { preHandler: [requireBotAuth, requireAnyBotScope('channels:read', 'channels:write')] },
 *   handler
 * );
 */
export function requireAnyBotScope(...allowedScopes: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ensure bot context exists
    if (!req.botContext) {
      throw new UnauthorizedError('Bot authentication required');
    }

    const { scopes } = req.botContext;

    // Check if bot has at least one of the allowed scopes
    const hasScope = allowedScopes.some((allowed) => scopes.includes(allowed));

    if (!hasScope) {
      throw new ForbiddenError(
        `Missing required scope. Need one of: ${allowedScopes.join(', ')}`
      );
    }
  };
}

/**
 * Helper to check if a bot has a specific scope
 * (for use in route handlers, not as middleware)
 *
 * @param req - Fastify request with bot context
 * @param scope - Scope to check for
 * @returns True if bot has the scope
 */
export function hasBotScope(req: FastifyRequest, scope: string): boolean {
  if (!req.botContext) {
    return false;
  }

  return req.botContext.scopes.includes(scope);
}

/**
 * Helper to check if a bot has any of the specified scopes
 * (for use in route handlers, not as middleware)
 *
 * @param req - Fastify request with bot context
 * @param scopes - Scopes to check for
 * @returns True if bot has at least one of the scopes
 */
export function hasAnyBotScope(req: FastifyRequest, ...scopes: string[]): boolean {
  if (!req.botContext) {
    return false;
  }

  return scopes.some((scope) => req.botContext!.scopes.includes(scope));
}
