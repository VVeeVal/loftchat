import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Rate limiter tiers following Slack's API rate limits
 */
export enum RateLimitTier {
  /** Tier 1: 1 request per second */
  TIER_1 = 'tier1',
  /** Tier 2: 20 requests per minute */
  TIER_2 = 'tier2',
  /** Tier 3: 50 requests per minute */
  TIER_3 = 'tier3',
  /** Tier 4: 100 requests per minute */
  TIER_4 = 'tier4',
  /** Events: 30,000 events per hour per app per org */
  EVENTS = 'events'
}

interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.TIER_1]: {
    requests: 1,
    windowMs: 1000 // 1 second
  },
  [RateLimitTier.TIER_2]: {
    requests: 20,
    windowMs: 60000 // 1 minute
  },
  [RateLimitTier.TIER_3]: {
    requests: 50,
    windowMs: 60000 // 1 minute
  },
  [RateLimitTier.TIER_4]: {
    requests: 100,
    windowMs: 60000 // 1 minute
  },
  [RateLimitTier.EVENTS]: {
    requests: 30000,
    windowMs: 3600000 // 1 hour
  }
};

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Key format: {tier}:{appId}:{organizationId}
const rateLimitStore = new Map<string, RequestRecord>();

/**
 * Cleans up expired rate limit records
 */
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredRecords, 5 * 60 * 1000);

/**
 * Rate limiter middleware factory
 *
 * @param tier - The rate limit tier to apply
 * @returns Middleware function
 *
 * @example
 * // Apply Tier 1 rate limiting (1 req/sec)
 * fastify.post('/api/bot/chat.postMessage',
 *   { preHandler: [requireBotAuth, botRateLimiter(RateLimitTier.TIER_1)] },
 *   handler
 * );
 */
export function botRateLimiter(tier: RateLimitTier) {
  const config = RATE_LIMITS[tier];

  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Rate limiting only applies to bot requests
    if (!req.botContext) {
      return;
    }

    const { appId, organizationId } = req.botContext;
    const key = `${tier}:${appId}:${organizationId}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // Create new record if it doesn't exist or has expired
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(key, record);
    }

    // Increment request count
    record.count++;

    // Calculate remaining requests
    const remaining = Math.max(0, config.requests - record.count);
    const resetInSeconds = Math.ceil((record.resetTime - now) / 1000);

    // Set Slack-compatible rate limit headers
    reply.header('X-Rate-Limit-Limit', config.requests);
    reply.header('X-Rate-Limit-Remaining', remaining);
    reply.header('X-Rate-Limit-Reset', Math.floor(record.resetTime / 1000));

    // Check if rate limit exceeded
    if (record.count > config.requests) {
      reply.header('Retry-After', resetInSeconds);
      reply.status(429).send({
        ok: false,
        error: 'rate_limited',
        message: `Rate limit exceeded. Retry after ${resetInSeconds} seconds.`
      });
      return;
    }
  };
}

/**
 * Helper to check if an app is rate limited (for non-HTTP contexts)
 *
 * @param appId - The app ID
 * @param organizationId - The organization ID
 * @param tier - The rate limit tier
 * @returns Object with limited status and retry info
 */
export function checkRateLimit(
  appId: string,
  organizationId: string,
  tier: RateLimitTier
): {
  limited: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
} {
  const config = RATE_LIMITS[tier];
  const key = `${tier}:${appId}:${organizationId}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || record.resetTime < now) {
    // Not rate limited
    return {
      limited: false,
      remaining: config.requests,
      resetTime: now + config.windowMs,
      retryAfter: 0
    };
  }

  const remaining = Math.max(0, config.requests - record.count);
  const limited = record.count >= config.requests;
  const retryAfter = limited ? Math.ceil((record.resetTime - now) / 1000) : 0;

  return {
    limited,
    remaining,
    resetTime: record.resetTime,
    retryAfter
  };
}

/**
 * Increments rate limit counter (for non-HTTP contexts like events)
 *
 * @param appId - The app ID
 * @param organizationId - The organization ID
 * @param tier - The rate limit tier
 * @returns True if increment succeeded (not rate limited)
 */
export function incrementRateLimit(
  appId: string,
  organizationId: string,
  tier: RateLimitTier
): boolean {
  const config = RATE_LIMITS[tier];
  const key = `${tier}:${appId}:${organizationId}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || record.resetTime < now) {
    record = {
      count: 1,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, record);
    return true;
  }

  record.count++;
  return record.count <= config.requests;
}

/**
 * Resets rate limit for an app (useful for testing or manual overrides)
 *
 * @param appId - The app ID
 * @param organizationId - The organization ID
 * @param tier - The rate limit tier
 */
export function resetRateLimit(
  appId: string,
  organizationId: string,
  tier: RateLimitTier
): void {
  const key = `${tier}:${appId}:${organizationId}`;
  rateLimitStore.delete(key);
}
