import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1)
});

export const messageIdParamSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1)
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1)
});
