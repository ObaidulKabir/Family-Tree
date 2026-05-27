import type { Prisma, PrismaClient } from '@prisma/client'

type DbClient = Prisma.TransactionClient | PrismaClient

export async function getBranchScopeAccessiblePersonIds(tx: DbClient, membershipId: string) {
  const scopes = await tx.graphMembershipScope.findMany({
    where: {
      membershipId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      anchorPersonId: true,
    },
  })

  if (scopes.length === 0) {
    return new Set<string>()
  }

  const anchorIds = [...new Set(scopes.map((scope) => scope.anchorPersonId))]
  const anchors = await tx.person.findMany({
    where: { id: { in: anchorIds } },
    select: {
      id: true,
      childOfFamily: {
        select: {
          parent1Id: true,
          parent2Id: true,
          children: { select: { id: true } },
        },
      },
      familiesAsParent1: {
        select: {
          parent2Id: true,
          children: { select: { id: true } },
        },
      },
      familiesAsParent2: {
        select: {
          parent1Id: true,
          children: { select: { id: true } },
        },
      },
    },
  })

  const accessibleIds = new Set<string>()

  for (const anchor of anchors) {
    accessibleIds.add(anchor.id)
    if (anchor.childOfFamily?.parent1Id) accessibleIds.add(anchor.childOfFamily.parent1Id)
    if (anchor.childOfFamily?.parent2Id) accessibleIds.add(anchor.childOfFamily.parent2Id)
    for (const sibling of anchor.childOfFamily?.children ?? []) {
      accessibleIds.add(sibling.id)
    }
    for (const family of anchor.familiesAsParent1) {
      if (family.parent2Id) accessibleIds.add(family.parent2Id)
      for (const child of family.children) {
        accessibleIds.add(child.id)
      }
    }
    for (const family of anchor.familiesAsParent2) {
      if (family.parent1Id) accessibleIds.add(family.parent1Id)
      for (const child of family.children) {
        accessibleIds.add(child.id)
      }
    }
  }

  return accessibleIds
}

