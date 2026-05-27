import { z } from 'zod'

export const EducationHistoryEntrySchema = z.object({
  institution: z.string().trim().default(''),
  degree: z.string().trim().default(''),
  fieldOfStudy: z.string().trim().default(''),
  startYear: z.string().trim().default(''),
  endYear: z.string().trim().default(''),
  description: z.string().trim().default(''),
})

export const ProfessionalHistoryEntrySchema = z.object({
  company: z.string().trim().default(''),
  position: z.string().trim().default(''),
  startYear: z.string().trim().default(''),
  endYear: z.string().trim().default(''),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().default(''),
})

export type EducationHistoryEntry = z.infer<typeof EducationHistoryEntrySchema>
export type ProfessionalHistoryEntry = z.infer<typeof ProfessionalHistoryEntrySchema>

const EducationHistorySchema = z.array(EducationHistoryEntrySchema)
const ProfessionalHistorySchema = z.array(ProfessionalHistoryEntrySchema)

export function normalizeEducationHistory(input: unknown): EducationHistoryEntry[] {
  const parsed = EducationHistorySchema.safeParse(input)
  if (!parsed.success) return []

  return parsed.data.filter((entry) =>
    Boolean(entry.institution || entry.degree || entry.fieldOfStudy || entry.startYear || entry.endYear || entry.description)
  )
}

export function normalizeProfessionalHistory(input: unknown): ProfessionalHistoryEntry[] {
  const parsed = ProfessionalHistorySchema.safeParse(input)
  if (!parsed.success) return []

  return parsed.data.filter((entry) =>
    Boolean(entry.company || entry.position || entry.startYear || entry.endYear || entry.description || entry.isCurrent)
  )
}

function parseYear(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return Number.NEGATIVE_INFINITY
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export function getLatestProfessionalPosition(history: ProfessionalHistoryEntry[]) {
  if (history.length === 0) return null

  const sorted = [...history].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1
    }

    const endYearDiff = parseYear(right.endYear) - parseYear(left.endYear)
    if (endYearDiff !== 0) return endYearDiff

    const startYearDiff = parseYear(right.startYear) - parseYear(left.startYear)
    if (startYearDiff !== 0) return startYearDiff

    return right.position.localeCompare(left.position)
  })

  return sorted[0]
}

