const GRAPH_ROLE_PRIORITY = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 3,
} as const

export type GraphRole = keyof typeof GRAPH_ROLE_PRIORITY
const GRAPH_INVITE_ROLE_MAP: Record<GraphRole, GraphRole[]> = {
  VIEWER: ['VIEWER'],
  COMMENTER: ['VIEWER'],
  EDITOR: ['EDITOR', 'VIEWER'],
  ADMIN: ['EDITOR', 'COMMENTER', 'VIEWER'],
  OWNER: ['EDITOR', 'COMMENTER', 'VIEWER'],
}

function normalizeGraphRole(role?: string | null) {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toUpperCase()
  if (!normalized) return null
  if (!(normalized in GRAPH_ROLE_PRIORITY)) return null
  return normalized as GraphRole
}

export function canViewGraph(role?: string | null) {
  return normalizeGraphRole(role) !== null
}

export function canEditGraph(role?: string | null) {
  const normalized = normalizeGraphRole(role)
  if (!normalized) return false
  return GRAPH_ROLE_PRIORITY[normalized] >= GRAPH_ROLE_PRIORITY.EDITOR
}

export function canManageGraph(role?: string | null) {
  const normalized = normalizeGraphRole(role)
  return normalized === 'ADMIN' || normalized === 'OWNER'
}

export function getAllowedInviteRoles(role?: string | null) {
  const normalized = normalizeGraphRole(role)
  if (!normalized) return [] as GraphRole[]
  return GRAPH_INVITE_ROLE_MAP[normalized]
}

export function canInviteGraph(role?: string | null) {
  return getAllowedInviteRoles(role).length > 0
}

export function canInviteGraphRole(role?: string | null, targetRole?: string | null) {
  const target = normalizeGraphRole(targetRole)
  if (!target) return false
  return getAllowedInviteRoles(role).includes(target)
}

export function isGraphInvitationExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime()
}

export function getContributorPresence(lastSeenAt?: Date | null, now = new Date()) {
  if (!lastSeenAt) return 'offline' as const

  const elapsedMs = now.getTime() - lastSeenAt.getTime()
  if (elapsedMs <= 2 * 60 * 1000) return 'online' as const
  if (elapsedMs <= 30 * 60 * 1000) return 'away' as const
  return 'offline' as const
}

export function validateOptimisticConcurrency(input: {
  currentUpdatedAt: Date
  expectedUpdatedAt?: Date | null
}) {
  if (!input.expectedUpdatedAt) {
    return { valid: true as const }
  }

  if (input.currentUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    return { valid: false as const, error: 'This record was updated by another contributor. Refresh and try again.' }
  }

  return { valid: true as const }
}

export function buildGraphAuditDetails<T extends Record<string, unknown>>(action: string, details: T) {
  return JSON.stringify({
    action,
    ...details,
  })
}

