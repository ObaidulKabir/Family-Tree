import { isExportTrustEnforcementEnabled } from './flags'

export type GraphCollaborationRole =
  | 'OWNER'
  | 'VERIFIER'
  | 'CONTRIBUTOR'
  | 'BRANCH_CONTRIBUTOR'
  | 'VIEWER'
  | 'ADMIN'
  | 'EDITOR'
  | 'COMMENTER'

export type GraphPermissionMode = 'view' | 'edit' | 'manage'
export type GraphTrustLevel = 'INVITED' | 'REGISTERED' | 'VERIFIED' | 'TRUSTED' | 'ELEVATED'

const ROLE_PRIORITY: Record<string, number> = {
  VIEWER: 0,
  COMMENTER: 1,
  BRANCH_CONTRIBUTOR: 2,
  CONTRIBUTOR: 2,
  EDITOR: 2,
  VERIFIER: 3,
  OWNER: 4,
  ADMIN: 4,
}

const TRUST_PRIORITY: Record<string, number> = {
  INVITED: 0,
  REGISTERED: 1,
  VERIFIED: 2,
  TRUSTED: 3,
  ELEVATED: 4,
}

export function canPerformGraphMode(role: string, mode: GraphPermissionMode) {
  const priority = ROLE_PRIORITY[role] ?? -1
  if (mode === 'view') return priority >= (ROLE_PRIORITY.VIEWER ?? 0)
  if (mode === 'edit') return priority >= (ROLE_PRIORITY.EDITOR ?? 0)
  return priority >= (ROLE_PRIORITY.ADMIN ?? 0)
}

export function requiresBranchScope(role: string, scopeMode?: string | null) {
  return role === 'BRANCH_CONTRIBUTOR' || scopeMode === 'BRANCH'
}

export function hasRequiredTrustLevel(trustLevel: string | null | undefined, minimum: GraphTrustLevel) {
  const current = TRUST_PRIORITY[trustLevel ?? 'REGISTERED'] ?? TRUST_PRIORITY.REGISTERED
  return current >= TRUST_PRIORITY[minimum]
}

export function canExportFullGraph(role: string, trustLevel?: string | null) {
  const roleAllowed = role === 'OWNER' || role === 'ADMIN'
  if (!roleAllowed) return false
  if (!isExportTrustEnforcementEnabled()) return true
  return hasRequiredTrustLevel(trustLevel, 'TRUSTED')
}

