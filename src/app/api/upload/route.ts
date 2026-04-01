import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getImageExtension, validateImageUpload } from '@/lib/upload'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const personId = formData.get('personId')
  const replace = formData.get('replace') === 'true'
  const rawPhotoDate = formData.get('photoDate')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded.' }, { status: 400 })
  }

  if (typeof personId !== 'string' || !personId) {
    return Response.json({ error: 'Missing person id.' }, { status: 400 })
  }

  const validation = validateImageUpload({
    mimeType: file.type,
    size: file.size,
  })

  if (!validation.valid) {
    return Response.json({ error: validation.error }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const photoDate =
    typeof rawPhotoDate === 'string' && rawPhotoDate
      ? new Date(rawPhotoDate)
      : undefined

  if (photoDate && Number.isNaN(photoDate.getTime())) {
    return Response.json({ error: 'Invalid photo date.' }, { status: 400 })
  }

  const extension = getImageExtension(file.name, file.type)
  const displayFileName = `${personId}${extension}`

  const photo = await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.photo.deleteMany({
        where: { personId },
      })
    }

    const created = await tx.photo.create({
      data: {
        url: displayFileName,
        personId,
        date: photoDate,
        data: Buffer.from(bytes),
        mimeType: file.type,
      },
      select: { id: true },
    })

    const url = `/api/photo/${created.id}`
    await tx.photo.update({
      where: { id: created.id },
      data: { url },
    })

    return { id: created.id, url }
  })

  return Response.json({ success: true, ...photo })
}

