-- AlterTable
ALTER TABLE "GraphMembership"
ADD COLUMN     "trustLevel" TEXT NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "scopeMode" TEXT NOT NULL DEFAULT 'FULL',
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revocationReason" TEXT;

-- AlterTable
ALTER TABLE "GraphInvitation"
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'COLLABORATION',
ADD COLUMN     "tokenHash" TEXT,
ADD COLUMN     "claimedByUserId" TEXT,
ADD COLUMN     "targetPersonId" TEXT,
ADD COLUMN     "previewScopeJson" JSONB,
ADD COLUMN     "branchScopeJson" JSONB,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "failureCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GraphAuditLog"
ADD COLUMN     "actorMembershipId" TEXT,
ADD COLUMN     "actorRole" TEXT,
ADD COLUMN     "actorTrustLevel" TEXT,
ADD COLUMN     "previousValueJson" JSONB,
ADD COLUMN     "newValueJson" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "evidenceJson" JSONB,
ADD COLUMN     "branchScopeJson" JSONB,
ADD COLUMN     "approvalState" TEXT,
ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "GraphMembershipScope" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "anchorPersonId" TEXT NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphMembershipScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphMembership_graphId_trustLevel_status_idx" ON "GraphMembership"("graphId", "trustLevel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GraphInvitation_tokenHash_key" ON "GraphInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "GraphInvitation_graphId_tokenHash_idx" ON "GraphInvitation"("graphId", "tokenHash");

-- CreateIndex
CREATE INDEX "GraphMembershipScope_graphId_membershipId_status_idx" ON "GraphMembershipScope"("graphId", "membershipId", "status");

-- CreateIndex
CREATE INDEX "GraphMembershipScope_anchorPersonId_idx" ON "GraphMembershipScope"("anchorPersonId");

-- CreateIndex
CREATE INDEX "GraphMembershipScope_expiresAt_idx" ON "GraphMembershipScope"("expiresAt");

-- AddForeignKey
ALTER TABLE "GraphMembership" ADD CONSTRAINT "GraphMembership_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphInvitation" ADD CONSTRAINT "GraphInvitation_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphInvitation" ADD CONSTRAINT "GraphInvitation_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembershipScope" ADD CONSTRAINT "GraphMembershipScope_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembershipScope" ADD CONSTRAINT "GraphMembershipScope_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "GraphMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembershipScope" ADD CONSTRAINT "GraphMembershipScope_anchorPersonId_fkey" FOREIGN KEY ("anchorPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembershipScope" ADD CONSTRAINT "GraphMembershipScope_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembershipScope" ADD CONSTRAINT "GraphMembershipScope_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
