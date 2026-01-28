-- AddColumn isAdmin to User if it doesn't exist
ALTER TABLE "user" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Organization
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for Organization name
CREATE UNIQUE INDEX "organization_name_key" ON "organization"("name");

-- CreateTable OrganizationMember
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for OrganizationMember
CREATE UNIQUE INDEX "organization_member_organizationId_userId_key" ON "organization_member"("organizationId", "userId");

-- Add indexes for OrganizationMember
CREATE INDEX "organization_member_organizationId_idx" ON "organization_member"("organizationId");
CREATE INDEX "organization_member_userId_idx" ON "organization_member"("userId");

-- Create default organization
INSERT INTO "organization" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('default-org', 'Default Organization', 'Default organization for existing data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add organizationId to existing users as members (admins get ADMIN role, others get MEMBER)
INSERT INTO "organization_member" ("id", "organizationId", "userId", "role", "joinedAt")
SELECT
    gen_random_uuid()::text,
    'default-org',
    "id",
    CASE WHEN "isAdmin" = true THEN 'ADMIN' ELSE 'MEMBER' END,
    CURRENT_TIMESTAMP
FROM "user";

-- AddColumn organizationId to Channel
ALTER TABLE "Channel" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org';

-- Update Channel unique constraint
DROP INDEX IF EXISTS "Channel_name_key";
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_organizationId_name_key" UNIQUE("organizationId", "name");

-- AddIndex on organizationId for Channel
CREATE INDEX "Channel_organizationId_idx" ON "Channel"("organizationId");

-- AddForeignKey Channel to Organization
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn organizationId to DMSession
ALTER TABLE "DMSession" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org';

-- AddIndex on organizationId for DMSession
CREATE INDEX "DMSession_organizationId_idx" ON "DMSession"("organizationId");

-- AddForeignKey DMSession to Organization
ALTER TABLE "DMSession" ADD CONSTRAINT "DMSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn organizationId to RegistrationLink
ALTER TABLE "RegistrationLink" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default-org';

-- AddIndex on organizationId for RegistrationLink
CREATE INDEX "RegistrationLink_organizationId_idx" ON "RegistrationLink"("organizationId");

-- AddForeignKey RegistrationLink to Organization
ALTER TABLE "RegistrationLink" ADD CONSTRAINT "RegistrationLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn activeOrganizationId to Session
ALTER TABLE "session" ADD COLUMN "activeOrganizationId" TEXT DEFAULT 'default-org';

-- AddIndex on activeOrganizationId for Session
CREATE INDEX "session_activeOrganizationId_idx" ON "session"("activeOrganizationId");

-- AddForeignKey Session to Organization
ALTER TABLE "session" ADD CONSTRAINT "session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey OrganizationMember to Organization
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey OrganizationMember to User
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable RegistrationLink
CREATE TABLE "registration_link" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "registration_link_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for registration_link token
CREATE UNIQUE INDEX "registration_link_token_key" ON "registration_link"("token");

-- Add indexes for registration_link
CREATE INDEX "registration_link_organizationId_idx" ON "registration_link"("organizationId");

-- AddForeignKey RegistrationLink to Organization
ALTER TABLE "registration_link" ADD CONSTRAINT "registration_link_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey RegistrationLink to User
ALTER TABLE "registration_link" ADD CONSTRAINT "registration_link_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
