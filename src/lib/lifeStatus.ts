export const LIFE_STATUS_VALUES = ['LIVING', 'DECEASED', 'UNKNOWN'] as const

export type LifeStatus = (typeof LIFE_STATUS_VALUES)[number]

export function normalizeLifeStatus(value?: string | null): LifeStatus {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'DECEASED' || normalized === 'UNKNOWN') return normalized
  return 'LIVING'
}

export function isDeceasedStatus(value?: string | null) {
  return normalizeLifeStatus(value) === 'DECEASED'
}

export function isLivingStatus(value?: string | null) {
  return normalizeLifeStatus(value) === 'LIVING'
}

export function getLifeStatusLabel(value?: string | null) {
  const status = normalizeLifeStatus(value)
  if (status === 'DECEASED') return 'In memory'
  if (status === 'UNKNOWN') return 'Status unknown'
  return 'Living'
}
