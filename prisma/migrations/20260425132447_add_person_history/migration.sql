-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "educationHistory" JSONB,
ADD COLUMN     "professionalHistory" JSONB;

-- AlterTable
ALTER TABLE "PersonLayer" ADD COLUMN     "educationHistory" JSONB,
ADD COLUMN     "professionalHistory" JSONB;
