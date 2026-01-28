import { z } from 'zod';

export const createBookmarkSchema = z.object({
  messageId: z.string().min(1).optional(),
  dmMessageId: z.string().min(1).optional()
}).refine((value) => Boolean(value.messageId) !== Boolean(value.dmMessageId), {
  message: 'Provide either messageId or dmMessageId',
  path: ['messageId']
});
