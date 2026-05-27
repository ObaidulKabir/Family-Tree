import { auth } from '@/auth'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function DELETE(_: Request, context: { params: Promise<{ id: string; photoId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, photoId } = await context.params

  try {
    await requireGraphPermissionForPerson(prisma, session.user.id, id, 'edit')

    await prisma.photo.deleteMany({
      where: {
        id: photoId,
        personId: id,
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete photo.'
    return Response.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}
