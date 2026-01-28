import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or less'),
  description: z.string().max(250, 'Description must be 250 characters or less').optional(),
  isPrivate: z.boolean().optional().default(false)
});

export const sendChannelMessageSchema = z.object({
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

export const editChannelMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000, 'Message must be 5000 characters or less')
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1, 'Emoji is required').max(50)
});

export const pinMessageSchema = z.object({
  isPinned: z.boolean().optional()
});

export const starChannelSchema = z.object({
  isStarred: z.boolean()
});

export const archiveChannelSchema = z.object({
  isArchived: z.boolean()
});

export const addChannelMemberSchema = z.object({
  userId: z.string().min(1)
});

export const channelNotificationPreferenceSchema = z.object({
  preference: z.enum(['ALL', 'MENTIONS', 'MUTE'])
});
