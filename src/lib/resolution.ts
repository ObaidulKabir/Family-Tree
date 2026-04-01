type ClaimLike = {
  id?: string
  personId: string
  field: string
  valueJson: unknown
  contributorId?: string | null
  sourceType?: string | null
  assertedDistance?: number | null
  computedDistance?: number | null
  confidenceScore?: number | null
  resolutionStatus?: string | null
  createdAt?: Date | string | null
}

type PersonLinkLike = {
  id: string
  leftPersonId: string
  rightPersonId: string
  resolutionStatus?: string | null
}

type FieldConflictDetail<TClaim extends ClaimLike> = {
  field: string
  winner: TClaim
  alternatives: TClaim[]
}

type ResolvablePerson = {
  id: string
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  nickName?: string | null
  title?: string | null
  gender?: string | null
  dateOfBirth?: Date | string | null
  placeOfBirth?: string | null
  dateOfDeath?: Date | string | null
  placeOfDeath?: string | null
}

const FIELD_NAMES = [
  'firstName',
  'lastName',
  'middleName',
  'nickName',
  'title',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'dateOfDeath',
  'placeOfDeath',
] as const

const SOURCE_TYPE_PRIORITY: Record<string, number> = {
  INVITATION_CONFIRMATION: 0,
  REGISTRATION: 1,
  USER: 2,
  SYSTEM_RECOVERY: 3,
}

function toDateValue(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

function normalizeValue(field: string, value: unknown) {
  if (value === null || value === undefined) return null
  if (field === 'dateOfBirth' || field === 'dateOfDeath') {
    return toDateValue(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (field === 'gender') {
      const normalizedGender = trimmed.toUpperCase()
      if (normalizedGender === 'UNKNOWN') return null
      return normalizedGender
    }

    return trimmed
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return value
}

function getDistanceScore(claim: ClaimLike) {
  return claim.computedDistance ?? claim.assertedDistance ?? Number.MAX_SAFE_INTEGER
}

function getSourcePriority(claim: ClaimLike) {
  return SOURCE_TYPE_PRIORITY[claim.sourceType ?? 'USER'] ?? 99
}

function getCreatedTime(claim: ClaimLike) {
  const value = claim.createdAt instanceof Date ? claim.createdAt : claim.createdAt ? new Date(claim.createdAt) : null
  return value && !Number.isNaN(value.getTime()) ? value.getTime() : Number.MAX_SAFE_INTEGER
}

export function sortClaimsByAuthenticity<T extends ClaimLike>(claims: T[]) {
  return [...claims].sort((left, right) => {
    const distanceDiff = getDistanceScore(left) - getDistanceScore(right)
    if (distanceDiff !== 0) return distanceDiff

    const sourceDiff = getSourcePriority(left) - getSourcePriority(right)
    if (sourceDiff !== 0) return sourceDiff

    const confidenceDiff = (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0)
    if (confidenceDiff !== 0) return confidenceDiff

    return getCreatedTime(right) - getCreatedTime(left)
  })
}

function collapseContributorEdits<T extends ClaimLike>(claims: T[]) {
  const grouped: Record<string, T> = {}
  const passthrough: T[] = []

  for (const claim of claims) {
    if (!claim.contributorId) {
      passthrough.push(claim)
      continue
    }

    const key = `${claim.contributorId}:${claim.field}`
    const existing = grouped[key]

    if (!existing) {
      grouped[key] = claim
      continue
    }

    const existingTime = getCreatedTime(existing)
    const nextTime = getCreatedTime(claim)
    if (nextTime >= existingTime) {
      grouped[key] = claim
    }
  }

  return [...Object.values(grouped), ...passthrough]
}

export function resolveFieldClaims<T extends ClaimLike>(claims: T[]) {
  const activeClaims = collapseContributorEdits(
    claims.filter((claim) => claim.resolutionStatus !== 'REJECTED' && claim.resolutionStatus !== 'HIDDEN')
  )
  if (activeClaims.length === 0) return null
  return sortClaimsByAuthenticity(activeClaims)[0] ?? null
}

export function detectFieldConflict<T extends ClaimLike>(claims: T[]) {
  const activeClaims = sortClaimsByAuthenticity(
    collapseContributorEdits(claims).filter((claim) => claim.resolutionStatus !== 'REJECTED' && claim.resolutionStatus !== 'HIDDEN')
  )

  if (activeClaims.length < 2) return false

  const winner = activeClaims[0]
  const winnerDistance = getDistanceScore(winner)
  const winnerValue = JSON.stringify(normalizeValue(winner.field, winner.valueJson))

  return activeClaims.slice(1).some((claim) => {
    const claimDistance = getDistanceScore(claim)
    if (claimDistance !== winnerDistance) return false
    return JSON.stringify(normalizeValue(claim.field, claim.valueJson)) !== winnerValue
  })
}

export function getFieldConflictDetails<T extends ClaimLike>(claims: T[]): FieldConflictDetail<T>[] {
  const fields = [...new Set(claims.map((claim) => claim.field))]

  return fields.flatMap((field) => {
    const fieldClaims = sortClaimsByAuthenticity(
      collapseContributorEdits(claims).filter((claim) => claim.field === field && claim.resolutionStatus !== 'REJECTED' && claim.resolutionStatus !== 'HIDDEN')
    )

    if (!detectFieldConflict(fieldClaims)) return []

    const winner = fieldClaims[0]
    if (!winner) return []

    const winnerDistance = getDistanceScore(winner)
    const winnerValue = JSON.stringify(normalizeValue(winner.field, winner.valueJson))
    const alternatives = fieldClaims.filter((claim) => {
      const claimDistance = getDistanceScore(claim)
      if (claimDistance !== winnerDistance) return false
      return JSON.stringify(normalizeValue(claim.field, claim.valueJson)) !== winnerValue
    })

    if (alternatives.length === 0) return []

    return [{ field, winner, alternatives }]
  })
}

export function resolvePersonFromClaims<TPerson extends ResolvablePerson, TClaim extends ClaimLike>(
  person: TPerson,
  claims: TClaim[]
) {
  const nextPerson = { ...person } as TPerson
  const writablePerson = nextPerson as Record<string, unknown>

  for (const field of FIELD_NAMES) {
    const winner = resolveFieldClaims(claims.filter((claim) => claim.field === field))
    if (!winner) continue
    writablePerson[field] = normalizeValue(field, winner.valueJson)
  }

  return nextPerson
}

export function groupClaimsByPerson<T extends ClaimLike>(claims: T[]) {
  return claims.reduce<Record<string, T[]>>((groups, claim) => {
    if (!groups[claim.personId]) groups[claim.personId] = []
    groups[claim.personId].push(claim)
    return groups
  }, {})
}

export function buildPersonReviewState<TClaim extends ClaimLike>(
  claims: TClaim[],
  links: PersonLinkLike[] = []
) {
  const conflictFields = getFieldConflictDetails(claims).map((detail) => detail.field)
  const openLinkCount = links.filter((link) => link.resolutionStatus !== 'REJECTED' && link.resolutionStatus !== 'ACCEPTED').length

  return {
    conflictFields,
    openLinkCount,
    hasConflicts: conflictFields.length > 0,
    needsReview: conflictFields.length > 0 || openLinkCount > 0,
    status:
      conflictFields.length > 0 ? 'needs_review' :
      openLinkCount > 0 ? 'linked' :
      'clean',
  }
}

export function summarizeReviewQueue(
  people: Array<{
    id: string
    reviewState?: {
      conflictFields?: string[]
      openLinkCount?: number
      needsReview?: boolean
    }
  }>
) {
  return people.reduce(
    (summary, person) => {
      const conflictCount = person.reviewState?.conflictFields?.length ?? 0
      const linkCount = person.reviewState?.openLinkCount ?? 0
      if (conflictCount > 0) summary.peopleWithConflicts += 1
      if (linkCount > 0) summary.peopleWithLinks += 1
      summary.totalConflictFields += conflictCount
      summary.totalOpenLinks += linkCount
      return summary
    },
    {
      peopleWithConflicts: 0,
      peopleWithLinks: 0,
      totalConflictFields: 0,
      totalOpenLinks: 0,
    }
  )
}

