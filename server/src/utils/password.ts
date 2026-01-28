import { randomBytes } from 'crypto';

/**
 * Generates a secure random password
 * - 16 characters
 * - Mix of uppercase, lowercase, numbers, and symbols
 * - Excludes ambiguous characters (0/O, 1/l/I, etc.)
 */
export function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes I, O
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Excludes i, l, o
  const numbers = '23456789'; // Excludes 0, 1
  const symbols = '!@#$%^&*-_+=';

  const chars = uppercase + lowercase + numbers + symbols;

  let password = '';
  const randomBuffer = randomBytes(16);

  for (let i = 0; i < 16; i++) {
    password += chars[randomBuffer[i] % chars.length];
  }

  // Ensure at least one of each type
  const parts = [
    uppercase[randomBytes(1)[0] % uppercase.length],
    lowercase[randomBytes(1)[0] % lowercase.length],
    numbers[randomBytes(1)[0] % numbers.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];

  // Replace random positions with guaranteed character types
  for (let i = 0; i < parts.length; i++) {
    const pos = randomBytes(1)[0] % 16;
    const arr = password.split('');
    arr[pos] = parts[i];
    password = arr.join('');
  }

  return password;
}

/**
 * Validates password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
