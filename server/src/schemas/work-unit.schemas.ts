import { z } from 'zod';

export const workUnitStatusEnum = z.enum([
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'REVIEW',
  'COMPLETED',
  'CANCELLED'
]);

export const createWorkUnitSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  goal: z.string().trim().min(1, 'Goal is required').max(10000, 'Goal must be 10000 characters or less'),
  context: z.string().max(10000, 'Context must be 10000 characters or less').optional(),
  sourceMessageId: z.string().optional(),
  sourceDMMessageId: z.string().optional()
}).refine(
  (data) => !(data.sourceMessageId && data.sourceDMMessageId),
  {
    message: 'Cannot specify both sourceMessageId and sourceDMMessageId',
    path: ['sourceMessageId']
  }
);

export const updateWorkUnitSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').optional(),
  goal: z.string().trim().min(1, 'Goal is required').max(10000, 'Goal must be 10000 characters or less').optional(),
  context: z.string().max(10000, 'Context must be 10000 characters or less').nullable().optional()
});

export const updateWorkUnitStatusSchema = z.object({
  status: workUnitStatusEnum
});

export const assignAgentSchema = z.object({
  botUserId: z.string().min(1, 'Bot user ID is required')
});

export const addReviewerSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
});

export const workUnitMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000, 'Message must be 5000 characters or less')
});

export const addWorkUnitOutputSchema = z.object({
  type: z.string().trim().min(1, 'Type is required').max(50, 'Type must be 50 characters or less'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.unknown()).optional()
});

export const workUnitIdParamSchema = z.object({
  id: z.string().min(1, 'Work unit ID is required')
});

export const workUnitAgentParamSchema = z.object({
  id: z.string().min(1, 'Work unit ID is required'),
  botUserId: z.string().min(1, 'Bot user ID is required')
});

export const workUnitReviewerParamSchema = z.object({
  id: z.string().min(1, 'Work unit ID is required'),
  userId: z.string().min(1, 'User ID is required')
});
