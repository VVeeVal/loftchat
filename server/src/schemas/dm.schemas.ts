import { z } from 'zod';

export const createDMSessionSchema = z.object({
  targetUserId: z.string().min(1)
});

export const sendDMMessageSchema = z.object({
  content: z.string().trim().max(5000, 'Message must be 5000 characters or less').optional().default(''),
  threadId: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().min(1),
    filename: z.string().min(1),
    mimetype: z.string().min(1),
    size: z.number().int().nonnegative(),
    uploadId: z.string().optional()
  })).optional().default([])
}).refine((value) => value.content.trim().length > 0 || value.attachments.length > 0, {
  message: 'Message cannot be empty',
  path: ['content']
});

export const editDMMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000, 'Message must be 5000 characters or less')
});

export const starDMSchema = z.object({
  isStarred: z.boolean()
});

export const archiveDMSchema = z.object({
  isArchived: z.boolean()
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1, 'Emoji is required').max(50)
});

export const dmNotificationPreferenceSchema = z.object({
  preference: z.enum(['ALL', 'MENTIONS', 'MUTE'])
});
