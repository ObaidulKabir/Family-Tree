-- AlterTable
ALTER TABLE "Person" ADD COLUMN "lifeStatus" TEXT NOT NULL DEFAULT 'LIVING';

-- AlterTable
ALTER TABLE "PersonLayer" ADD COLUMN "lifeStatus" TEXT;

-- Backfill existing status from death data
UPDATE "Person"
SET "lifeStatus" = CASE
  WHEN "dateOfDeath" IS NOT NULL THEN 'DECEASED'
  ELSE 'LIVING'
END
WHERE "lifeStatus" IS NULL OR "lifeStatus" = 'LIVING';

UPDATE "PersonLayer"
SET "lifeStatus" = CASE
  WHEN "dateOfDeath" IS NOT NULL THEN 'DECEASED'
  ELSE 'LIVING'
END
WHERE "lifeStatus" IS NULL;
