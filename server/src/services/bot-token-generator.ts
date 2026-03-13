import crypto from 'crypto';

/**
 * Generates a Slack-compatible bot token in the format: xoxb-{orgId}-{random}
 *
 * @param organizationId - The organization ID to include in the token
 * @returns A bot token string
 */
export function generateBotToken(organizationId: string): string {
  // Generate 32 bytes of random data and encode as base64url (URL-safe)
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('base64url');

  // Format: xoxb-{orgId}-{random}
  return `xoxb-${organizationId}-${randomString}`;
}

/**
 * Hashes a token using SHA-256 for secure storage in the database
 *
 * @param token - The plaintext token to hash
 * @returns A hex-encoded hash of the token
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Verifies a plaintext token against a stored hash
 *
 * @param token - The plaintext token to verify
 * @param hash - The stored hash to compare against
 * @returns True if the token matches the hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}

/**
 * Generates a response_url token for slash command delayed responses
 *
 * @returns A random token string
 */
export function generateResponseToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generates a webhook verification challenge string
 *
 * @returns A random challenge string
 */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a WebSocket connection ID
 *
 * @returns A random connection ID string
 */
export function generateConnectionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a client ID for an app
 *
 * @returns A random client ID string
 */
export function generateClientId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a client secret for an app
 *
 * @returns A random client secret string
 */
export function generateClientSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}
