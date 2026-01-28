import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  name: z.string().max(120).optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().min(1)
});
