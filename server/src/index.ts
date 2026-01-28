import { prisma } from './db.js';
import { buildApp } from './app.js';
import { config } from './config/index.js';

async function seedDatabase() {
    try {
        // Ensure default organization exists
        let defaultOrg = await prisma.organization.findUnique({ where: { id: 'default-org' } });
        if (!defaultOrg) {
            defaultOrg = await prisma.organization.create({
                data: {
                    id: 'default-org',
                    name: 'Default Organization',
                    description: 'Default organization for existing data',
                }
            });
        }

        let systemUser = await prisma.user.findFirst({ where: { email: 'system@loft.chat' } });
        if (!systemUser) {
            systemUser = await prisma.user.create({
                data: {
                    email: 'system@loft.chat',
                    name: 'System',
                    id: 'system',
                    emailVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });
        }

        // Ensure system user is a member of default org
        const existingMembership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: 'default-org',
                    userId: 'system'
                }
            }
        });

        if (!existingMembership) {
            await prisma.organizationMember.create({
                data: {
                    organizationId: 'default-org',
                    userId: 'system',
                    role: 'ADMIN'
                }
            });
        }

        const general = await prisma.channel.findFirst({
            where: {
                organizationId: 'default-org',
                name: 'general'
            }
        });
        if (!general) {
            await prisma.channel.create({
                data: {
                    name: 'general',
                    description: 'General discussion',
                    createdBy: systemUser.id,
                    organizationId: 'default-org',
                    isPrivate: false
                }
            });
            console.log("Seeded 'general' channel");
        }
    } catch (e) {
        console.error("Seeding failed", e);
    }
}

const start = async () => {
    try {
        const app = await buildApp();

        // Seed database
        await seedDatabase();

        // Start server
        await app.listen({ port: config.port, host: '0.0.0.0' });
        console.log(`Server started on port ${config.port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
