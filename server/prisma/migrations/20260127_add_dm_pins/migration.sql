-- Add isPinned to DMMessage for DM pinning
ALTER TABLE "DMMessage" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
