-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "livingHistory" JSONB;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "ageLabel" TEXT,
ADD COLUMN     "albumCategory" TEXT,
ADD COLUMN     "isGroupPhoto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "peopleTags" JSONB;
