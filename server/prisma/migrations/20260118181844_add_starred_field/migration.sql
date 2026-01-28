-- AlterTable
ALTER TABLE "ChannelMember" ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DMParticipant" ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false;
