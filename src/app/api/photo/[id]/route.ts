import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { auth } from '@/auth'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const params = await context.params
  const id = params.id

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { data: true, mimeType: true, url: true, personId: true },
  })

  if (!photo) {
    return new Response('Not found', { status: 404 })
  }

  try {
    await requireGraphPermissionForPerson(prisma, session.user.id, photo.personId, 'view')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return new Response(message, { status: message === 'Forbidden' ? 403 : 400 })
  }

  if (photo.data) {
    return new Response(photo.data, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  const target = photo.url
  if (target.startsWith('/uploads/')) {
    const diskPath = path.join(process.cwd(), 'public', target.replaceAll('\\', '/'))
    try {
      const file = await readFile(diskPath)
      const extension = path.extname(target).toLowerCase()
      const contentType =
        extension === '.png' ? 'image/png' :
        extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' :
        extension === '.webp' ? 'image/webp' :
        extension === '.gif' ? 'image/gif' :
        'application/octet-stream'

      return new Response(file, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  }

  if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('/')) {
    return Response.redirect(target, 302)
  }

  return new Response('Not found', { status: 404 })
}
