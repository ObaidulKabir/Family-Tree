import { z } from 'zod'

export const LivingHistoryEntrySchema = z.object({
  placeName: z.string().trim().default(''),
  address: z.string().trim().default(''),
  startDate: z.string().trim().default(''),
  endDate: z.string().trim().default(''),
  notes: z.string().trim().default(''),
  latitude: z.string().trim().default(''),
  longitude: z.string().trim().default(''),
})

export const LifePhotoMetadataSchema = z.object({
  albumCategory: z.enum(['PORTRAIT', 'GROUP']).default('PORTRAIT'),
  ageLabel: z.string().trim().default(''),
  locationLabel: z.string().trim().default(''),
  isGroupPhoto: z.boolean().default(false),
  peopleTags: z.array(z.string().trim().min(1)).default([]),
  caption: z.string().trim().default(''),
})

export type LivingHistoryEntry = z.infer<typeof LivingHistoryEntrySchema>
export type LifePhotoMetadata = z.infer<typeof LifePhotoMetadataSchema>

export function normalizeLivingHistory(input: unknown): LivingHistoryEntry[] {
  const parsed = z.array(LivingHistoryEntrySchema).safeParse(input)
  if (!parsed.success) return []

  return parsed.data.filter((entry) =>
    Boolean(entry.placeName || entry.address || entry.startDate || entry.endDate || entry.notes || entry.latitude || entry.longitude)
  )
}

function toTimestamp(value: string) {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime()
}

export function sortLivingHistory(entries: LivingHistoryEntry[]) {
  return [...entries].sort((left, right) => {
    const startDiff = toTimestamp(right.startDate) - toTimestamp(left.startDate)
    if (startDiff !== 0) return startDiff
    return toTimestamp(right.endDate) - toTimestamp(left.endDate)
  })
}

export function buildResidenceMapLink(entry: LivingHistoryEntry) {
  const query = [entry.placeName, entry.address].filter(Boolean).join(', ')
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function deriveAgeLabel(photoDate: Date | null | undefined, dateOfBirth: Date | null | undefined) {
  if (!photoDate || !dateOfBirth) return ''
  const age = photoDate.getFullYear() - dateOfBirth.getFullYear()
  if (age < 0) return ''
  if (age <= 2) return 'Infancy'
  if (age <= 5) return 'Early childhood'
  if (age <= 12) return 'Childhood'
  if (age <= 17) return 'Teen years'
  if (age <= 25) return 'Young adult'
  if (age <= 45) return 'Adulthood'
  if (age <= 64) return 'Midlife'
  return 'Senior years'
}

