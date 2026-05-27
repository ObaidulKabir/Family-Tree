import { auth } from '@/auth'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'
import { normalizeEducationHistory, normalizeProfessionalHistory } from '@/lib/personHistory'
import { normalizeLivingHistory } from '@/lib/personExplore'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const permission = await requireGraphPermissionForPerson(prisma, session.user.id, id, 'view')
    const person = await prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        nickName: true,
        title: true,
        dateOfBirth: true,
        placeOfBirth: true,
        dateOfDeath: true,
        placeOfDeath: true,
        educationHistory: true,
        professionalHistory: true,
        livingHistory: true,
      },
    })

    if (!person) {
      return Response.json({ error: 'Person not found' }, { status: 404 })
    }

    return Response.json({
      person: {
        ...person,
        educationHistory: normalizeEducationHistory(person.educationHistory),
        professionalHistory: normalizeProfessionalHistory(person.professionalHistory),
        livingHistory: normalizeLivingHistory(person.livingHistory),
      },
      permission,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return Response.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    await requireGraphPermissionForPerson(prisma, session.user.id, id, 'edit')
    const body = (await request.json()) as {
      educationHistory?: unknown
      professionalHistory?: unknown
      livingHistory?: unknown
    }

    const updated = await prisma.person.update({
      where: { id },
      data: {
        educationHistory: body.educationHistory !== undefined ? normalizeEducationHistory(body.educationHistory) : undefined,
        professionalHistory: body.professionalHistory !== undefined ? normalizeProfessionalHistory(body.professionalHistory) : undefined,
        livingHistory: body.livingHistory !== undefined ? normalizeLivingHistory(body.livingHistory) : undefined,
      },
      select: {
        id: true,
        educationHistory: true,
        professionalHistory: true,
        livingHistory: true,
        updatedAt: true,
      },
    })

    return Response.json({
      success: true,
      person: {
        ...updated,
        educationHistory: normalizeEducationHistory(updated.educationHistory),
        professionalHistory: normalizeProfessionalHistory(updated.professionalHistory),
        livingHistory: normalizeLivingHistory(updated.livingHistory),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update person profile'
    return Response.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}

