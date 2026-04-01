'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function resolvePersonFieldConflict(input: {
  personId: string
  field: string
  winningClaimId: string
  decision: 'use_suggested' | 'keep_current'
}) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const userId = session.user.id

  const { personId, field, winningClaimId, decision } = input

  try {
    await prisma.$transaction(async (tx) => {
      const winningClaim = await tx.personClaim.findUnique({
        where: { id: winningClaimId },
      })

      if (!winningClaim || winningClaim.personId !== personId || winningClaim.field !== field) {
        throw new Error('Winning claim not found')
      }

      await tx.personClaim.update({
        where: { id: winningClaimId },
        data: { resolutionStatus: 'ACTIVE' },
      })

      await tx.personClaim.updateMany({
        where: {
          personId,
          field,
          id: { not: winningClaimId },
          resolutionStatus: { not: 'REJECTED' },
        },
        data: {
          resolutionStatus: 'HIDDEN',
          supersedesClaimId: winningClaimId,
        },
      })

      const existingCase = await tx.resolutionCase.findFirst({
        where: {
          entityType: 'PERSON_FIELD',
          entityRefId: personId,
          field,
        },
      })

      const rationaleJson = {
        winningClaimId,
        decision,
        resolvedByUserId: userId,
      }

      if (existingCase) {
        await tx.resolutionCase.update({
          where: { id: existingCase.id },
          data: {
            status: 'RESOLVED',
            rationaleJson,
            createdByUserId: userId,
          },
        })
      } else {
        await tx.resolutionCase.create({
          data: {
            entityType: 'PERSON_FIELD',
            entityRefId: personId,
            field,
            status: 'RESOLVED',
            rationaleJson,
            createdByUserId: userId,
          },
        })
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/review')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'Failed to resolve field conflict' }
  }
}

export async function resolvePersonLinkDecision(input: {
  linkId: string
  decision: 'same_person' | 'different_people'
}) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }
  const userId = session.user.id

  const { linkId, decision } = input

  try {
    await prisma.$transaction(async (tx) => {
      const link = await tx.personLink.findUnique({
        where: { id: linkId },
      })

      if (!link) {
        throw new Error('Link not found')
      }

      const existingCase = await tx.resolutionCase.findFirst({
        where: {
          entityType: 'PERSON_LINK',
          entityRefId: linkId,
        },
      })

      const resolutionCase = existingCase
        ? await tx.resolutionCase.update({
            where: { id: existingCase.id },
            data: {
              status: 'RESOLVED',
              rationaleJson: {
                decision,
                resolvedByUserId: userId,
              },
              createdByUserId: userId,
            },
          })
        : await tx.resolutionCase.create({
            data: {
              entityType: 'PERSON_LINK',
              entityRefId: linkId,
              status: 'RESOLVED',
              rationaleJson: {
                decision,
                resolvedByUserId: userId,
              },
              createdByUserId: userId,
            },
          })

      await tx.personLink.update({
        where: { id: linkId },
        data: {
          linkType: decision === 'same_person' ? 'VERIFIED_SAME' : 'NOT_SAME',
          resolutionStatus: decision === 'same_person' ? 'ACCEPTED' : 'REJECTED',
          resolutionCaseId: resolutionCase.id,
        },
      })
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/review')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'Failed to resolve person link' }
  }
}

