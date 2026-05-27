import type { Prisma, PrismaClient } from '@prisma/client'

import { getBranchScopeMode } from './flags'
import { canExportFullGraph, canPerformGraphMode, requiresBranchScope } from './policy'
import { getBranchScopeAccessiblePersonIds } from './scope'

type DbClient = Prisma.TransactionClient | PrismaClient

export type AuthorizedGraphContext = {
  graphId: string
  membershipId: string
  role: string
  trustLevel: string
  scopeMode: string
}

export async function authorizePersonAccess(
  tx: DbClient,
  input: {
    userId: string
    personId: string
    mode: 'view' | 'edit' | 'manage'
  }
) {
  const [user, person] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.userId },
      select: { currentGraphId: true },
    }),
    tx.person.findUnique({
      where: { id: input.personId },
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
        userId: input.userId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
      trustLevel: true,
      scopeMode: true,
    },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('Access revoked')
  }

  if (!canPerformGraphMode(membership.role, input.mode)) {
    if (input.mode === 'manage') {
      throw new Error('Only the graph admin can manage contributors.')
    }
    if (input.mode === 'edit') {
      throw new Error('You do not have permission to edit this graph.')
    }
    throw new Error('Forbidden')
  }

  const scopeMode = getBranchScopeMode()
  const needsScope = input.mode === 'edit' && scopeMode !== 'off' && requiresBranchScope(membership.role, membership.scopeMode)
  let inBranchScope = true

  if (needsScope) {
    const accessibleIds = await getBranchScopeAccessiblePersonIds(tx, membership.id)
    inBranchScope = accessibleIds.has(person.id)
  }

  const result: {
    context: AuthorizedGraphContext
    shouldAttachGraphId: boolean
    branchScope: { mode: typeof scopeMode; checked: boolean; inScope: boolean }
  } = {
    context: {
      graphId,
      membershipId: membership.id,
      role: membership.role,
      trustLevel: membership.trustLevel,
      scopeMode: membership.scopeMode,
    },
    shouldAttachGraphId: !person.graphId,
    branchScope: {
      mode: scopeMode,
      checked: needsScope,
      inScope: inBranchScope,
    },
  }

  if (result.branchScope.checked && !result.branchScope.inScope && result.branchScope.mode === 'enforce') {
    throw new Error('This edit is outside your assigned branch scope.')
  }

  return result
}

export async function authorizePersonAccessInGraph(
  tx: DbClient,
  input: {
    userId: string
    personId: string
    graphId: string
    mode: 'view' | 'edit' | 'manage'
  }
) {
  const person = await tx.person.findUnique({
    where: { id: input.personId },
    select: { id: true, graphId: true },
  })

  if (!person) {
    throw new Error('Person not found')
  }

  if (person.graphId && person.graphId !== input.graphId) {
    throw new Error('Person belongs to a different graph.')
  }

  const membership = await tx.graphMembership.findUnique({
    where: {
      graphId_userId: {
        graphId: input.graphId,
        userId: input.userId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
      trustLevel: true,
      scopeMode: true,
    },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('Access revoked')
  }

  if (!canPerformGraphMode(membership.role, input.mode)) {
    if (input.mode === 'manage') {
      throw new Error('Only the graph admin can manage contributors.')
    }
    if (input.mode === 'edit') {
      throw new Error('You do not have permission to edit this graph.')
    }
    throw new Error('Forbidden')
  }

  const scopeMode = getBranchScopeMode()
  const needsScope = input.mode === 'edit' && scopeMode !== 'off' && requiresBranchScope(membership.role, membership.scopeMode)
  let inBranchScope = true

  if (needsScope) {
    const accessibleIds = await getBranchScopeAccessiblePersonIds(tx, membership.id)
    inBranchScope = accessibleIds.has(person.id)
  }

  const result: {
    context: AuthorizedGraphContext
    shouldAttachGraphId: boolean
    branchScope: { mode: typeof scopeMode; checked: boolean; inScope: boolean }
  } = {
    context: {
      graphId: input.graphId,
      membershipId: membership.id,
      role: membership.role,
      trustLevel: membership.trustLevel,
      scopeMode: membership.scopeMode,
    },
    shouldAttachGraphId: !person.graphId,
    branchScope: {
      mode: scopeMode,
      checked: needsScope,
      inScope: inBranchScope,
    },
  }

  if (result.branchScope.checked && !result.branchScope.inScope && result.branchScope.mode === 'enforce') {
    throw new Error('This edit is outside your assigned branch scope.')
  }

  return result
}

export async function authorizeExportFullGraphAccess(
  tx: DbClient,
  input: { userId: string }
) {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { currentGraphId: true },
  })

  if (!user?.currentGraphId) {
    throw new Error('No active graph selected.')
  }

  const membership = await tx.graphMembership.findUnique({
    where: {
      graphId_userId: {
        graphId: user.currentGraphId,
        userId: input.userId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
      trustLevel: true,
      graphId: true,
    },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('Access revoked.')
  }

  if (!canExportFullGraph(membership.role, membership.trustLevel)) {
    throw new Error('You do not have permission to export this graph.')
  }

  return {
    graphId: membership.graphId,
    membershipId: membership.id,
    role: membership.role,
    trustLevel: membership.trustLevel,
  }
}

