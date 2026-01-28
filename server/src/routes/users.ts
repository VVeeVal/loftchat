import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { auth } from '../auth.js';
import { convertFastifyHeaders } from '../utils.js';
import { AuthenticatedRequest } from '../types/request.js';
import { requireOrganization } from '../organization-middleware.js';
import { validateBody } from '../plugins/validator.js';
import { changePasswordSchema, updateProfileSchema } from '../schemas/user.schemas.js';
import { AppError, BadRequestError, InternalServerError, UnauthorizedError, ValidationError } from '../errors/app-errors.js';
import { config } from '../config/index.js';
import { storageAdapter, isAllowedMimeType, cleanFilename } from '../utils/storage.js';
import { getPresenceForOrganization } from '../realtime.js';

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireOrganization);
  // Get presence status for all users in the organization
  app.get('/users/presence', async (req, res) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const presence = getPresenceForOrganization(orgContext.organizationId);
    return presence;
  });

  // List Users in Organization
  app.get('/users', async (req, res) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    // Get all users in the organization through organization members
    const users = await prisma.user.findMany({
      where: {
        organizationMemberships: {
          some: { organizationId: orgContext.organizationId }
        }
      },
      select: { id: true, name: true, email: true, image: true, bio: true }
    });
    return users;
  });

  // Get Me / Current User
  app.get('/users/me', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      throw new UnauthorizedError();
    }
    const me = await prisma.user.findUnique({ where: { id: user.id } });
    return me;
  });

  // Update Me / Current User Profile
  app.put<{ Body: { bio?: string; name?: string } }>('/users/me', {
    preHandler: [validateBody(updateProfileSchema)]
  }, async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      throw new UnauthorizedError();
    }
    const { bio, name } = req.body;

    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (name !== undefined) updateData.name = name;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
    return updated;
  });

  // Upload Avatar
  app.post('/users/me/avatar', async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      throw new UnauthorizedError();
    }

    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestError('No file');
    }

    if (!isAllowedMimeType(data.mimetype)) {
      data.file.resume();
      throw new BadRequestError('Unsupported file type');
    }

    const safeFilename = cleanFilename(data.filename || 'avatar');
    const { url, key, size } = await storageAdapter.save({
      stream: data.file,
      filename: safeFilename,
      mimetype: data.mimetype
    });

    if (data.file.truncated || size > config.maxUploadSizeBytes) {
      await storageAdapter.remove(key);
      throw new BadRequestError(`File exceeds max size of ${config.maxUploadSizeBytes} bytes`);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { image: url }
    });

    return updated;
  });

  // Change password (authenticated users)
  app.post<{ Body: { currentPassword: string; newPassword: string } }>('/users/change-password', {
    preHandler: [validateBody(changePasswordSchema)]
  }, async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = req.body;

    // Import password validation
    const { validatePasswordStrength } = await import('../utils/password.js');
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      const headers = convertFastifyHeaders(req.headers);
      const changePasswordRequest = new Request(
        new URL('/api/auth/change-password', config.betterAuthUrl).toString(),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        }
      );

      const response = await auth.handler(changePasswordRequest);
      if (response.ok) {
        return { success: true, message: 'Password changed successfully' };
      }

      const errorPayload = await response.json().catch(() => null);
      if (response.status === 401) {
        throw new UnauthorizedError('Current password is incorrect');
      }
      if (response.status === 400) {
        throw new BadRequestError(errorPayload?.error || 'Invalid password');
      }

      throw new InternalServerError('Failed to change password');
    } catch (error) {
      app.log.error('Password change failed:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new InternalServerError('Failed to change password');
    }
  });
}
