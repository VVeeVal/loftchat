import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(120),
  description: z.string().max(500).optional()
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional()
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1)
});
