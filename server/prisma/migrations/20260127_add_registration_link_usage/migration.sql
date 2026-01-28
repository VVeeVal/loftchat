-- Add usage tracking for registration links
ALTER TABLE "RegistrationLink"
ADD COLUMN IF NOT EXISTS "usageLimit" INTEGER,
ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill defaults for existing links
UPDATE "RegistrationLink"
SET "usageLimit" = 1
WHERE "usageLimit" IS NULL;

UPDATE "RegistrationLink"
SET "usageCount" = CASE WHEN "isUsed" = TRUE THEN 1 ELSE 0 END
WHERE "usageCount" = 0;
