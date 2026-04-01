-- CreateTable
CREATE TABLE "UserPersonLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assertedDistance" INTEGER,
    "computedDistance" INTEGER,
    "distancePath" JSONB,
    "invitedByUserId" TEXT,
    "invitationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPersonLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonClaim" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "contributorId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'USER',
    "sourceRefId" TEXT,
    "assertedDistance" INTEGER,
    "computedDistance" INTEGER,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "corroborationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "supersedesClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipClaim" (
    "id" TEXT NOT NULL,
    "fromPersonId" TEXT NOT NULL,
    "toPersonId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "contributorId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'USER',
    "sourceRefId" TEXT,
    "assertedDistance" INTEGER,
    "computedDistance" INTEGER,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationshipClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonLink" (
    "id" TEXT NOT NULL,
    "leftPersonId" TEXT NOT NULL,
    "rightPersonId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'POSSIBLE_SAME',
    "sourceType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT,
    "resolutionCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionCase" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityRefId" TEXT NOT NULL,
    "field" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "rationaleJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPersonLink_personId_computedDistance_idx" ON "UserPersonLink"("personId", "computedDistance");

-- CreateIndex
CREATE INDEX "UserPersonLink_userId_status_idx" ON "UserPersonLink"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonLink_userId_personId_key" ON "UserPersonLink"("userId", "personId");

-- CreateIndex
CREATE INDEX "PersonClaim_personId_field_resolutionStatus_idx" ON "PersonClaim"("personId", "field", "resolutionStatus");

-- CreateIndex
CREATE INDEX "PersonClaim_contributorId_createdAt_idx" ON "PersonClaim"("contributorId", "createdAt");

-- CreateIndex
CREATE INDEX "RelationshipClaim_fromPersonId_relationshipType_resolutionS_idx" ON "RelationshipClaim"("fromPersonId", "relationshipType", "resolutionStatus");

-- CreateIndex
CREATE INDEX "RelationshipClaim_toPersonId_relationshipType_resolutionSta_idx" ON "RelationshipClaim"("toPersonId", "relationshipType", "resolutionStatus");

-- CreateIndex
CREATE INDEX "PersonLink_resolutionStatus_linkType_idx" ON "PersonLink"("resolutionStatus", "linkType");

-- CreateIndex
CREATE UNIQUE INDEX "PersonLink_leftPersonId_rightPersonId_key" ON "PersonLink"("leftPersonId", "rightPersonId");

-- CreateIndex
CREATE INDEX "ResolutionCase_entityType_entityRefId_status_idx" ON "ResolutionCase"("entityType", "entityRefId", "status");

-- AddForeignKey
ALTER TABLE "UserPersonLink" ADD CONSTRAINT "UserPersonLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPersonLink" ADD CONSTRAINT "UserPersonLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonClaim" ADD CONSTRAINT "PersonClaim_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipClaim" ADD CONSTRAINT "RelationshipClaim_fromPersonId_fkey" FOREIGN KEY ("fromPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipClaim" ADD CONSTRAINT "RelationshipClaim_toPersonId_fkey" FOREIGN KEY ("toPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipClaim" ADD CONSTRAINT "RelationshipClaim_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonLink" ADD CONSTRAINT "PersonLink_leftPersonId_fkey" FOREIGN KEY ("leftPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonLink" ADD CONSTRAINT "PersonLink_rightPersonId_fkey" FOREIGN KEY ("rightPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonLink" ADD CONSTRAINT "PersonLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionCase" ADD CONSTRAINT "ResolutionCase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
