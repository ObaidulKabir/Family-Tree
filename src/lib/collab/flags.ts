export type BranchScopeMode = 'off' | 'observe' | 'enforce'

export function getBranchScopeMode(): BranchScopeMode {
  const explicitMode = process.env.FEATURE_GRAPH_BRANCH_SCOPE_MODE?.trim().toLowerCase()
  if (explicitMode === 'off' || explicitMode === 'observe' || explicitMode === 'enforce') {
    return explicitMode
  }

  if (process.env.FEATURE_GRAPH_BRANCH_SCOPE_ENFORCEMENT === 'true') {
    return 'enforce'
  }

  return 'observe'
}

export function isExportTrustEnforcementEnabled() {
  return process.env.FEATURE_GRAPH_EXPORT_TRUST_ENFORCEMENT === 'true'
}

