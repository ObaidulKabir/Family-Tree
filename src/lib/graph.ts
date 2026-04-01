import { Prisma, type PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

type UserPersonLinkInput = {
  userId: string
  personId: string
  role?: string
  status?: string
  assertedDistance?: number | null
  computedDistance?: number | null
  distancePath?: Prisma.InputJsonValue | null
  invitedByUserId?: string | null
  invitationId?: string | null
}

type ClaimInput = {
  personId: string
  contributorId?: string | null
  sourceType?: string
  sourceRefId?: string | null
  assertedDistance?: number | null
  computedDistance?: number | null
  confidenceScore?: number
  values: Record<string, unknown>
}

type RelationshipClaimInput = {
  fromPersonId: string
  toPersonId: string
  relationshipType: string
  contributorId?: string | null
  sourceType?: string
  sourceRefId?: string | null
  assertedDistance?: number | null
  computedDistance?: number | null
  confidenceScore?: number
}

export function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? 'User',
    lastName: parts.slice(1).join(' '),
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  if (value === null) return Prisma.JsonNull
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item)) as Prisma.InputJsonValue
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(record)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, toJsonValue(entryValue)])
    ) as Prisma.InputJsonValue
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

export async function upsertUserPersonLink(db: DbClient, input: UserPersonLinkInput) {
  return db.userPersonLink.upsert({
    where: {
      userId_personId: {
        userId: input.userId,
        personId: input.personId,
      },
    },
    update: {
      role: input.role ?? undefined,
      status: input.status ?? undefined,
      assertedDistance: input.assertedDistance ?? undefined,
      computedDistance: input.computedDistance ?? undefined,
      distancePath: input.distancePath ?? undefined,
      invitedByUserId: input.invitedByUserId ?? undefined,
      invitationId: input.invitationId ?? undefined,
    },
    create: {
      userId: input.userId,
      personId: input.personId,
      role: input.role ?? 'CONTRIBUTOR',
      status: input.status ?? 'ACTIVE',
      assertedDistance: input.assertedDistance ?? undefined,
      computedDistance: input.computedDistance ?? undefined,
      distancePath: input.distancePath ?? undefined,
      invitedByUserId: input.invitedByUserId ?? undefined,
      invitationId: input.invitationId ?? undefined,
    },
  })
}

export async function createPersonClaims(db: DbClient, input: ClaimInput) {
  const entries = Object.entries(input.values).filter(([, value]) => value !== undefined)

  for (const [field, value] of entries) {
    await db.personClaim.create({
      data: {
        personId: input.personId,
        field,
        valueJson: toJsonValue(value),
        contributorId: input.contributorId ?? undefined,
        sourceType: input.sourceType ?? 'USER',
        sourceRefId: input.sourceRefId ?? undefined,
        assertedDistance: input.assertedDistance ?? undefined,
        computedDistance: input.computedDistance ?? undefined,
        confidenceScore: input.confidenceScore ?? 1,
      },
    })
  }
}

export async function createRelationshipClaim(db: DbClient, input: RelationshipClaimInput) {
  return db.relationshipClaim.create({
    data: {
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      relationshipType: input.relationshipType,
      contributorId: input.contributorId ?? undefined,
      sourceType: input.sourceType ?? 'USER',
      sourceRefId: input.sourceRefId ?? undefined,
      assertedDistance: input.assertedDistance ?? undefined,
      computedDistance: input.computedDistance ?? undefined,
      confidenceScore: input.confidenceScore ?? 1,
    },
  })
}

export async function computeRelationshipDistance(db: DbClient, userId: string, targetPersonId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { rootPersonId: true },
  })

  if (!user?.rootPersonId) return null
  if (user.rootPersonId === targetPersonId) return 0

  const visited = new Set<string>([user.rootPersonId])
  const queue: Array<{ personId: string; distance: number }> = [
    { personId: user.rootPersonId, distance: 0 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (current.distance >= 8) continue

    const person = await db.person.findUnique({
      where: { id: current.personId },
      select: {
        id: true,
        childOfFamily: {
          select: {
            parent1Id: true,
            parent2Id: true,
            children: {
              select: { id: true },
            },
          },
        },
        familiesAsParent1: {
          select: {
            parent2Id: true,
            children: {
              select: { id: true },
            },
          },
        },
        familiesAsParent2: {
          select: {
            parent1Id: true,
            children: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!person) continue

    const nextIds = new Set<string>()

    if (person.childOfFamily?.parent1Id) nextIds.add(person.childOfFamily.parent1Id)
    if (person.childOfFamily?.parent2Id) nextIds.add(person.childOfFamily.parent2Id)
    for (const sibling of person.childOfFamily?.children ?? []) {
      if (sibling.id !== person.id) nextIds.add(sibling.id)
    }

    for (const family of person.familiesAsParent1) {
      if (family.parent2Id) nextIds.add(family.parent2Id)
      for (const child of family.children) nextIds.add(child.id)
    }

    for (const family of person.familiesAsParent2) {
      if (family.parent1Id) nextIds.add(family.parent1Id)
      for (const child of family.children) nextIds.add(child.id)
    }

    for (const nextId of nextIds) {
      if (visited.has(nextId)) continue
      if (nextId === targetPersonId) return current.distance + 1
      visited.add(nextId)
      queue.push({ personId: nextId, distance: current.distance + 1 })
    }
  }

  return null
}
