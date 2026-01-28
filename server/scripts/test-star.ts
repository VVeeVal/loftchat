import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testStarring() {
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found");
        return;
    }

    const channel = await prisma.channel.findFirst();
    if (channel) {
        console.log(`Testing star for channel ${channel.name} (${channel.id}) for user ${user.email}`);
        try {
            // Check if member exists
            const member = await prisma.channelMember.findUnique({
                where: { channelId_userId: { channelId: channel.id, userId: user.id } }
            });
            console.log(`Current member status: ${member ? (member.isStarred ? 'Starred' : 'Not Starred') : 'Not a member'}`);
        } catch (e) {
            console.error(e);
        }
    }

    const dm = await prisma.dMSession.findFirst({
        where: { participants: { some: { userId: user.id } } },
        include: { participants: true }
    });
    if (dm) {
        console.log(`Testing star for DM ${dm.id} for user ${user.email}`);
        const participant = dm.participants.find(p => p.userId === user.id);
        console.log(`Current participant status: ${participant?.isStarred ? 'Starred' : 'Not Starred'}`);
    }
}

testStarring()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
