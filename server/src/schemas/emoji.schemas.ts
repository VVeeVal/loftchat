import { z } from 'zod';

export const createCustomEmojiSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50).regex(/^[a-zA-Z0-9_+-]+$/, 'Name must be alphanumeric with _ + - allowed'),
  imageUrl: z.string().trim().min(1, 'Image URL is required')
});

export const updateCustomEmojiSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_+-]+$/, 'Name must be alphanumeric with _ + - allowed').optional(),
  imageUrl: z.string().trim().min(1).optional()
});
