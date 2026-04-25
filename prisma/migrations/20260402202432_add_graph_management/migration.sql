-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "graphId" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "graphId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentGraphId" TEXT;

-- CreateTable
CREATE TABLE "FamilyGraph" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "rootPersonId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphMembership" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invitedByUserId" TEXT,
    "invitationId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "currentPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphInvitation" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphAuditLog" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGraph_rootPersonId_key" ON "FamilyGraph"("rootPersonId");

-- CreateIndex
CREATE INDEX "FamilyGraph_adminUserId_status_idx" ON "FamilyGraph"("adminUserId", "status");

-- CreateIndex
CREATE INDEX "GraphMembership_graphId_status_role_idx" ON "GraphMembership"("graphId", "status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "GraphMembership_graphId_userId_key" ON "GraphMembership"("graphId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GraphInvitation_token_key" ON "GraphInvitation"("token");

-- CreateIndex
CREATE INDEX "GraphInvitation_graphId_status_expiresAt_idx" ON "GraphInvitation"("graphId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "GraphInvitation_email_status_idx" ON "GraphInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "GraphAuditLog_graphId_createdAt_idx" ON "GraphAuditLog"("graphId", "createdAt");

-- CreateIndex
CREATE INDEX "GraphAuditLog_action_entityType_idx" ON "GraphAuditLog"("action", "entityType");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentGraphId_fkey" FOREIGN KEY ("currentGraphId") REFERENCES "FamilyGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGraph" ADD CONSTRAINT "FamilyGraph_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGraph" ADD CONSTRAINT "FamilyGraph_rootPersonId_fkey" FOREIGN KEY ("rootPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembership" ADD CONSTRAINT "GraphMembership_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembership" ADD CONSTRAINT "GraphMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMembership" ADD CONSTRAINT "GraphMembership_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphInvitation" ADD CONSTRAINT "GraphInvitation_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphInvitation" ADD CONSTRAINT "GraphInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphInvitation" ADD CONSTRAINT "GraphInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphAuditLog" ADD CONSTRAINT "GraphAuditLog_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "FamilyGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphAuditLog" ADD CONSTRAINT "GraphAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
