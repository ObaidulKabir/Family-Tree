'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const SearchUsersSchema = z.object({
  query: z.string().trim().max(100).optional(),
})

export async function searchUsers(input?: { query?: string }) {
  const session = await auth()
  if (!session?.user?.id) return { users: [], error: 'Unauthorized' as const }

  const parsed = SearchUsersSchema.safeParse(input ?? {})
  if (!parsed.success) return { users: [], error: 'Invalid query' as const }

  const query = parsed.data.query?.trim()

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      email: { not: null },
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 25,
  })

  return { users, error: null }
}
