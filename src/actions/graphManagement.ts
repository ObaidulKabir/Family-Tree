'use server'

import { randomBytes } from 'node:crypto'

import type { Prisma, PrismaClient } from '@prisma/client'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  buildGraphAuditDetails,
  canEditGraph,
  canManageGraph,
  canViewGraph,
  getContributorPresence,
  isGraphInvitationExpired,
} from '@/lib/graphManagement'
import { revalidatePath } from 'next/cache'

const GRAPH_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

type DbClient = Prisma.TransactionClient | PrismaClient

async function backfillGraphTree(tx: Prisma.TransactionClient, graphId: string, rootPersonId: string) {
  const visitedPeople = new Set<string>()
  const visitedFamilies = new Set<string>()
  const queue = [rootPersonId]

  while (queue.length > 0) {
    const batch = queue.splice(0, 25).filter((personId) => !visitedPeople.has(personId))
    if (batch.length === 0) continue

    batch.forEach((personId) => visitedPeople.add(personId))

    const people = await tx.person.findMany({
      where: { id: { in: batch } },
      select: {
        id: true,
        childOfFamilyId: true,
        familiesAsParent1: { select: { id: true } },
        familiesAsParent2: { select: { id: true } },
      },
    })

    await tx.person.updateMany({
      where: { id: { in: people.map((person) => person.id) } },
      data: { graphId },
    })

    const familyIds = [
      ...new Set(
        people.flatMap((person) => [
          person.childOfFamilyId,
          ...person.familiesAsParent1.map((family) => family.id),
          ...person.familiesAsParent2.map((family) => family.id),
        ]).filter((familyId): familyId is string => Boolean(familyId))
      ),
    ].filter((familyId) => !visitedFamilies.has(familyId))

    if (familyIds.length === 0) continue

    familyIds.forEach((familyId) => visitedFamilies.add(familyId))

    await tx.family.updateMany({
      where: { id: { in: familyIds } },
      data: { graphId },
    })

    const families = await tx.family.findMany({
      where: { id: { in: familyIds } },
      select: {
        parent1Id: true,
        parent2Id: true,
        children: { select: { id: true } },
      },
    })

    for (const family of families) {
      const relatedPeople = [
        family.parent1Id,
        family.parent2Id,
        ...family.children.map((child) => child.id),
      ].filter((personId): personId is string => Boolean(personId))

      for (const relatedPersonId of relatedPeople) {
        if (!visitedPeople.has(relatedPersonId)) {
          queue.push(relatedPersonId)
        }
      }
    }
  }
}

async function writeGraphAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    graphId: string
    actorUserId?: string | null
    action: string
    entityType: string
    entityId?: string | null
    details?: Record<string, unknown>
  }
) {
  await tx.graphAuditLog.create({
    data: {
      graphId: input.graphId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      detailsJson: input.details ? JSON.parse(buildGraphAuditDetails(input.action, input.details)) : undefined,
    },
  })
}

export async function createGraphAuditEntry(
  tx: Prisma.TransactionClient,
  input: {
    graphId: string
    actorUserId?: string | null
    action: string
    entityType: string
    entityId?: string | null
    details?: Record<string, unknown>
  }
) {
  await writeGraphAuditLog(tx, input)
}

export async function ensurePrimaryGraphForUser(userId: string, displayName: string, rootPersonId: string) {
  return prisma.$transaction(async (tx) => {
    let graph = await tx.familyGraph.findFirst({
      where: { adminUserId: userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, rootPersonId: true },
    })

    if (!graph) {
      graph = await tx.familyGraph.create({
        data: {
          name: `${displayName}'s Family Graph`,
          adminUserId: userId,
          rootPersonId,
        },
        select: { id: true, name: true, rootPersonId: true },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_CREATED',
        entityType: 'GRAPH',
        entityId: graph.id,
        details: {
          name: graph.name,
          rootPersonId,
        },
      })
    } else if (!graph.rootPersonId) {
      graph = await tx.familyGraph.update({
        where: { id: graph.id },
        data: { rootPersonId },
        select: { id: true, name: true, rootPersonId: true },
      })
    }

    await tx.graphMembership.upsert({
      where: {
        graphId_userId: {
          graphId: graph.id,
          userId,
        },
      },
      update: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      create: {
        graphId: graph.id,
        userId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { currentGraphId: true },
    })

    if (!user?.currentGraphId) {
      await tx.user.update({
        where: { id: userId },
        data: {
          currentGraphId: graph.id,
        },
      })
    }

    await backfillGraphTree(tx, graph.id, rootPersonId)

    return graph
  })
}

export async function getCurrentGraphContext(userId: string, displayName: string, rootPersonId: string) {
  await ensurePrimaryGraphForUser(userId, displayName, rootPersonId)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { currentGraphId: true },
    })

    const currentMembership = user?.currentGraphId
      ? await tx.graphMembership.findUnique({
          where: {
            graphId_userId: {
              graphId: user.currentGraphId,
              userId,
            },
          },
          include: {
            graph: {
              select: {
                id: true,
                name: true,
                rootPersonId: true,
              },
            },
          },
        })
      : null

    if (currentMembership?.status === 'ACTIVE') {
      return {
        graphId: currentMembership.graph.id,
        graphName: currentMembership.graph.name,
        rootPersonId: currentMembership.graph.rootPersonId ?? rootPersonId,
        role: currentMembership.role,
      }
    }

    const firstMembership = await tx.graphMembership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        graph: {
          select: {
            id: true,
            name: true,
            rootPersonId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!firstMembership) {
      return {
        graphId: null,
        graphName: null,
        rootPersonId,
        role: null,
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { currentGraphId: firstMembership.graph.id },
    })

    return {
      graphId: firstMembership.graph.id,
      graphName: firstMembership.graph.name,
      rootPersonId: firstMembership.graph.rootPersonId ?? rootPersonId,
      role: firstMembership.role,
    }
  })
}

export async function requireGraphPermissionForPerson(
  tx: DbClient,
  userId: string,
  personId: string,
  mode: 'view' | 'edit' | 'manage'
) {
  const [user, person] = await Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { currentGraphId: true },
    }),
    tx.person.findUnique({
      where: { id: personId },
      select: { id: true, graphId: true },
    }),
  ])

  if (!person) {
    throw new Error('Person not found')
  }

  const graphId = person.graphId ?? user?.currentGraphId ?? null
  if (!graphId) {
    throw new Error('Graph context not found')
  }

  const membership = await tx.graphMembership.findUnique({
    where: {
      graphId_userId: {
        graphId,
        userId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('Access revoked')
  }

  if (mode === 'view' && !canViewGraph(membership.role)) {
    throw new Error('Forbidden')
  }

  if (mode === 'edit' && !canEditGraph(membership.role)) {
    throw new Error('You do not have permission to edit this graph.')
  }

  if (mode === 'manage' && !canManageGraph(membership.role)) {
    throw new Error('Only the graph admin can manage contributors.')
  }

  if (!person.graphId && 'person' in tx) {
    await tx.person.update({
      where: { id: personId },
      data: { graphId },
    })
  }

  return {
    graphId,
    role: membership.role,
  }
}

async function getAdminGraphForSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      rootPersonId: true,
    },
  })

  if (user?.rootPersonId) {
    await ensurePrimaryGraphForUser(
      user.id,
      user.name ?? 'User',
      user.rootPersonId
    )
  }

  const membership = await prisma.graphMembership.findFirst({
    where: {
      userId,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    include: {
      graph: {
        select: {
          id: true,
          name: true,
          rootPersonId: true,
          adminUserId: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!membership) {
    throw new Error('No managed graph found for this account.')
  }

  return membership.graph
}

export async function getGraphManagementPanelData() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  try {
    const graph = await getAdminGraphForSession(userId)

    const [memberships, invitations, auditLogs, graphCounts] = await Promise.all([
      prisma.graphMembership.findMany({
        where: { graphId: graph.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.graphInvitation.findMany({
        where: { graphId: graph.id },
        include: {
          invitedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.graphAuditLog.findMany({
        where: { graphId: graph.id },
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.familyGraph.findUnique({
        where: { id: graph.id },
        select: {
          _count: {
            select: {
              people: true,
              families: true,
              memberships: true,
              invitations: true,
            },
          },
        },
      }),
    ])

    const now = new Date()

    return {
      error: null,
      graph: {
        ...graph,
        counts: graphCounts?._count ?? {
          people: 0,
          families: 0,
          memberships: 0,
          invitations: 0,
        },
      },
      memberships: memberships.map((membership) => ({
        ...membership,
        presence: getContributorPresence(membership.lastSeenAt, now),
      })),
      invitations: invitations.map((invitation) => ({
        ...invitation,
        isExpired: isGraphInvitationExpired(invitation.expiresAt, now),
      })),
      auditLogs,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to load graph management data' }
  }
}

export async function renameGraph(name: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  const nextName = name.trim()
  if (!nextName) return { error: 'Graph name is required.' as const }

  try {
    const graph = await getAdminGraphForSession(userId)

    await prisma.$transaction(async (tx) => {
      await tx.familyGraph.update({
        where: { id: graph.id },
        data: { name: nextName },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_RENAMED',
        entityType: 'GRAPH',
        entityId: graph.id,
        details: {
          previousName: graph.name,
          nextName,
        },
      })
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/graph-management')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to rename graph' }
  }
}

export async function createGraphInvitation(email: string, role: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedRole = role.toUpperCase()
  if (!normalizedEmail) return { error: 'Email is required.' as const }
  if (!['VIEWER', 'COMMENTER', 'EDITOR'].includes(normalizedRole)) {
    return { error: 'Invalid contributor role.' as const }
  }

  try {
    const graph = await getAdminGraphForSession(userId)
    const token = randomBytes(32).toString('hex')
    const invitedUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.graphInvitation.create({
        data: {
          graphId: graph.id,
          email: normalizedEmail,
          role: normalizedRole,
          token,
          invitedByUserId: userId,
          invitedUserId: invitedUser?.id,
          expiresAt: new Date(Date.now() + GRAPH_INVITATION_TTL_MS),
        },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_INVITATION_CREATED',
        entityType: 'GRAPH_INVITATION',
        details: {
          email: normalizedEmail,
          role: normalizedRole,
        },
      })
    })

    revalidatePath('/dashboard/graph-management')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return { success: true, link: `${baseUrl}/invite/graph/${token}` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create graph invitation' }
  }
}

export async function revokeGraphInvitation(invitationId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  try {
    const graph = await getAdminGraphForSession(userId)

    await prisma.$transaction(async (tx) => {
      const invitation = await tx.graphInvitation.findUnique({
        where: { id: invitationId },
        select: { id: true, graphId: true, email: true, status: true },
      })

      if (!invitation || invitation.graphId !== graph.id) {
        throw new Error('Invitation not found')
      }

      await tx.graphInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
        },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_INVITATION_REVOKED',
        entityType: 'GRAPH_INVITATION',
        entityId: invitationId,
        details: {
          email: invitation.email,
          previousStatus: invitation.status,
        },
      })
    })

    revalidatePath('/dashboard/graph-management')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to revoke invitation' }
  }
}

export async function acceptGraphInvitation(token: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.graphInvitation.findUnique({
        where: { token },
        include: {
          graph: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!invitation) throw new Error('Invalid invitation')
      if (invitation.status === 'REVOKED') throw new Error('This invitation has been revoked.')

      if (isGraphInvitationExpired(invitation.expiresAt)) {
        await tx.graphInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        })
        throw new Error('This invitation has expired.')
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      })

      if (!user) throw new Error('User not found')
      if (!user.email || user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
        throw new Error('This invitation is only valid for the invited email address.')
      }

      await tx.graphMembership.upsert({
        where: {
          graphId_userId: {
            graphId: invitation.graphId,
            userId: user.id,
          },
        },
        update: {
          role: invitation.role,
          status: 'ACTIVE',
          invitedByUserId: invitation.invitedByUserId,
          invitationId: invitation.id,
          lastSeenAt: new Date(),
          lastActivityAt: new Date(),
        },
        create: {
          graphId: invitation.graphId,
          userId: user.id,
          role: invitation.role,
          status: 'ACTIVE',
          invitedByUserId: invitation.invitedByUserId,
          invitationId: invitation.id,
          lastSeenAt: new Date(),
          lastActivityAt: new Date(),
        },
      })

      await tx.graphInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: user.id,
        },
      })

      await tx.user.update({
        where: { id: user.id },
        data: { currentGraphId: invitation.graphId },
      })

      await writeGraphAuditLog(tx, {
        graphId: invitation.graphId,
        actorUserId: user.id,
        action: 'GRAPH_INVITATION_ACCEPTED',
        entityType: 'GRAPH_INVITATION',
        entityId: invitation.id,
        details: {
          email: invitation.email,
          role: invitation.role,
        },
      })

      return {
        success: true,
        graphName: invitation.graph.name,
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/graph-management')
    return result
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to accept invitation' }
  }
}

export async function updateGraphMembershipRole(membershipId: string, role: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  const normalizedRole = role.toUpperCase()
  if (!['VIEWER', 'COMMENTER', 'EDITOR'].includes(normalizedRole)) {
    return { error: 'Invalid contributor role.' as const }
  }

  try {
    const graph = await getAdminGraphForSession(userId)

    await prisma.$transaction(async (tx) => {
      const membership = await tx.graphMembership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          graphId: true,
          role: true,
          userId: true,
        },
      })

      if (!membership || membership.graphId !== graph.id) {
        throw new Error('Contributor not found')
      }

      if (membership.userId === userId) {
        throw new Error('The graph admin role cannot be reassigned.')
      }

      await tx.graphMembership.update({
        where: { id: membershipId },
        data: { role: normalizedRole },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_MEMBERSHIP_ROLE_UPDATED',
        entityType: 'GRAPH_MEMBERSHIP',
        entityId: membershipId,
        details: {
          previousRole: membership.role,
          nextRole: normalizedRole,
          userId: membership.userId,
        },
      })
    })

    revalidatePath('/dashboard/graph-management')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update contributor role' }
  }
}

export async function removeGraphContributor(membershipId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  try {
    const graph = await getAdminGraphForSession(userId)

    await prisma.$transaction(async (tx) => {
      const membership = await tx.graphMembership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          graphId: true,
          userId: true,
          role: true,
        },
      })

      if (!membership || membership.graphId !== graph.id) {
        throw new Error('Contributor not found')
      }

      if (membership.userId === userId) {
        throw new Error('The graph admin cannot remove themselves.')
      }

      await tx.graphMembership.update({
        where: { id: membershipId },
        data: {
          status: 'REVOKED',
        },
      })

      const fallbackMembership = await tx.graphMembership.findFirst({
        where: {
          userId: membership.userId,
          status: 'ACTIVE',
          graphId: { not: graph.id },
        },
        orderBy: { createdAt: 'asc' },
        select: { graphId: true },
      })

      await tx.user.update({
        where: { id: membership.userId },
        data: {
          currentGraphId: fallbackMembership?.graphId ?? null,
        },
      })

      await writeGraphAuditLog(tx, {
        graphId: graph.id,
        actorUserId: userId,
        action: 'GRAPH_CONTRIBUTOR_REMOVED',
        entityType: 'GRAPH_MEMBERSHIP',
        entityId: membershipId,
        details: {
          userId: membership.userId,
          previousRole: membership.role,
        },
      })
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/graph-management')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to remove contributor' }
  }
}

export async function touchGraphPresence(personId?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentGraphId: true },
  })

  if (!user?.currentGraphId) return { error: 'No active graph' as const }

  await prisma.graphMembership.updateMany({
    where: {
      graphId: user.currentGraphId,
      userId,
      status: 'ACTIVE',
    },
    data: {
      lastSeenAt: new Date(),
      lastActivityAt: new Date(),
      currentPersonId: personId ?? null,
    },
  })

  return { success: true }
}
