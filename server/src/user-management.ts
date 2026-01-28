import { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { auth } from './auth.js';
import { convertFastifyHeaders } from './utils.js';
import { generateSecurePassword } from './utils/password.js';
import { requireOrganizationAdmin } from './organization-middleware.js';
import { validateBody } from './plugins/validator.js';
import { adminResetPasswordSchema } from './schemas/user.schemas.js';
import { BadRequestError, InternalServerError, NotFoundError } from './errors/app-errors.js';
import { hashPassword } from 'better-auth/crypto';
import { AuthenticatedRequest } from './types/request.js';

export default async function userManagementRoutes(app: FastifyInstance) {
    // Middleware to ensure user is authenticated, in organization, and is admin
    app.addHook('preHandler', async (req, res) => {
        await requireOrganizationAdmin(req, res);
    });

    // List all users (admin only)
    app.get('/admin/list', async (req, res) => {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                isAdmin: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        });

        return { users };
    });

    // Reset user password (admin only)
    app.post<{ Body: { userId: string } }>('/admin/reset-password', {
        preHandler: [validateBody(adminResetPasswordSchema)]
    }, async (req, res) => {
        const { userId } = req.body;

        // Verify the user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!targetUser) {
            throw new NotFoundError('User not found');
        }

        // Prevent admin from resetting their own password via this endpoint
        const requestingUser = (req as AuthenticatedRequest).user;
        if (requestingUser.id === userId) {
            throw new BadRequestError('Cannot reset your own password this way. Use change password instead.');
        }

        // Generate new password
        const newPassword = generateSecurePassword();

        try {
            // Hash password using the same method as BetterAuth
            // For now, we'll update the account record directly
            // BetterAuth stores passwords in the Account table

            // Get or create account record for email/password provider
            let account = await prisma.account.findFirst({
                where: {
                    userId: userId,
                    providerId: 'credential'
                }
            });

            if (!account) {
                // Create account if it doesn't exist
                const accountId = `${userId}-email`;
                const passwordHash = await hashPassword(newPassword);
                account = await prisma.account.create({
                    data: {
                        id: accountId,
                        userId: userId,
                        accountId: targetUser.email,
                        providerId: 'credential',
                        password: passwordHash
                    }
                });
            } else {
                // Update existing account password
                const passwordHash = await hashPassword(newPassword);
                account = await prisma.account.update({
                    where: { id: account.id },
                    data: { password: passwordHash }
                });
            }

            await prisma.session.deleteMany({
                where: { userId }
            });

            return {
                newPassword,
                userId,
                message: 'Password reset successfully. Share this password securely with the user. It will only be shown once.'
            };
        } catch (error) {
            app.log.error('Password reset failed:', error);
            throw new InternalServerError('Failed to reset password');
        }
    });
}
