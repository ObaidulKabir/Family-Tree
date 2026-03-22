import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [users, persons, families, familyEvents, photos, personLayers, invitations] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        rootPersonId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.person.findMany(),
    prisma.family.findMany(),
    prisma.familyEvent.findMany(),
    prisma.photo.findMany(),
    prisma.personLayer.findMany(),
    prisma.invitation.findMany(),
  ])

  const payload = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
    },
    users,
    persons,
    families,
    familyEvents,
    photos,
    personLayers,
    invitations,
  }

  const json = JSON.stringify(payload)
  const fileName = `family-tree-export-${new Date().toISOString().replaceAll(':', '-')}.json`

  return new NextResponse(json, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  })
}

