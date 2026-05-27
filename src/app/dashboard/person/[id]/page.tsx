import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'
import PersonExploreView from '@/components/person/PersonExploreView'
import { prisma } from '@/lib/prisma'
import { canEditGraph } from '@/lib/graphManagement'
import { normalizeEducationHistory, normalizeProfessionalHistory } from '@/lib/personHistory'
import { normalizeLivingHistory } from '@/lib/personExplore'

export default async function PersonExplorePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params
  const permission = await requireGraphPermissionForPerson(prisma, session.user.id, id, 'view')

  const person = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
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
    redirect('/dashboard')
  }

  const photos = await prisma.photo.findMany({
    where: { personId: id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      date: true,
      caption: true,
      albumCategory: true,
      ageLabel: true,
      locationLabel: true,
      isGroupPhoto: true,
      peopleTags: true,
      createdAt: true,
    },
  })

  return (
    <PersonExploreView
      person={{
        ...person,
        educationHistory: normalizeEducationHistory(person.educationHistory),
        professionalHistory: normalizeProfessionalHistory(person.professionalHistory),
        livingHistory: normalizeLivingHistory(person.livingHistory),
      }}
      photos={photos}
      permission={{ role: permission.role, canEdit: canEditGraph(permission.role) }}
    />
  )
}

