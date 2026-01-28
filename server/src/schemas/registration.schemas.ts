import { z } from 'zod';

export const createRegistrationLinkSchema = z.object({
  expiresInHours: z.number().int().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  allowUnlimited: z.boolean().optional()
}).optional();
