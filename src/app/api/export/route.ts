import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { authorizeExportFullGraphAccess } from '@/lib/collab/authorize'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let exportContext: Awaited<ReturnType<typeof authorizeExportFullGraphAccess>>
  try {
    exportContext = await authorizeExportFullGraphAccess(prisma, { userId: session.user.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    const status = message === 'No active graph selected.' ? 400 : message === 'Unauthorized' ? 401 : 403
    return NextResponse.json({ error: message }, { status })
  }

  const [graph, members, persons, families, familyEvents, photos, personLayers, invitations, auditLogs] = await Promise.all([
    prisma.familyGraph.findUnique({
      where: { id: exportContext.graphId },
    }),
    prisma.graphMembership.findMany({
      where: { graphId: exportContext.graphId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rootPersonId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.person.findMany({
      where: { graphId: exportContext.graphId },
    }),
    prisma.family.findMany({
      where: { graphId: exportContext.graphId },
    }),
    prisma.familyEvent.findMany({
      where: {
        OR: [
          { person: { graphId: exportContext.graphId } },
          { family: { graphId: exportContext.graphId } },
        ],
      },
    }),
    prisma.photo.findMany({
      where: {
        person: { graphId: exportContext.graphId },
      },
    }),
    prisma.personLayer.findMany({
      where: {
        person: { graphId: exportContext.graphId },
      },
    }),
    prisma.graphInvitation.findMany({
      where: { graphId: exportContext.graphId },
    }),
    prisma.graphAuditLog.findMany({
      where: { graphId: exportContext.graphId },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  await prisma.graphAuditLog.create({
    data: {
      graphId: exportContext.graphId,
      actorUserId: session.user.id,
      actorMembershipId: exportContext.membershipId,
      actorRole: exportContext.role,
      actorTrustLevel: exportContext.trustLevel,
      action: 'GRAPH_EXPORTED',
      entityType: 'GRAPH',
      entityId: exportContext.graphId,
      approvalState: 'AUTO_APPROVED',
      detailsJson: {
        exportType: 'FULL_GRAPH',
      },
    },
  })

  const payload = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      graphId: exportContext.graphId,
    },
    graph,
    members,
    persons,
    families,
    familyEvents,
    photos,
    personLayers,
    invitations,
    auditLogs,
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

