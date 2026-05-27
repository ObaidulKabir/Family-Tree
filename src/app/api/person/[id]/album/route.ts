import { auth } from '@/auth'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'
import { deriveAgeLabel, LifePhotoMetadataSchema } from '@/lib/personExplore'
import { getImageExtension, validateImageUpload } from '@/lib/upload'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    await requireGraphPermissionForPerson(prisma, session.user.id, id, 'view')
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const category = searchParams.get('category')?.trim()

    const photos = await prisma.photo.findMany({
      where: {
        personId: id,
        ...(category ? { albumCategory: category } : {}),
        ...(query
          ? {
              OR: [
                { caption: { contains: query, mode: 'insensitive' } },
                { locationLabel: { contains: query, mode: 'insensitive' } },
                { ageLabel: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
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

    return Response.json({ photos })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return Response.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    await requireGraphPermissionForPerson(prisma, session.user.id, id, 'edit')

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return Response.json({ error: 'No file uploaded.' }, { status: 400 })
    }

    const validation = validateImageUpload({ mimeType: file.type, size: file.size })
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 })
    }

    const rawDate = formData.get('photoDate')
    const photoDate =
      typeof rawDate === 'string' && rawDate
        ? new Date(rawDate)
        : undefined

    if (photoDate && Number.isNaN(photoDate.getTime())) {
      return Response.json({ error: 'Invalid photo date.' }, { status: 400 })
    }

    const peopleTagsValue = formData.get('peopleTags')

    const metadata = LifePhotoMetadataSchema.parse({
      albumCategory: formData.get('albumCategory') === 'GROUP' ? 'GROUP' : 'PORTRAIT',
      ageLabel: typeof formData.get('ageLabel') === 'string' ? formData.get('ageLabel') : '',
      locationLabel: typeof formData.get('locationLabel') === 'string' ? formData.get('locationLabel') : '',
      isGroupPhoto: formData.get('isGroupPhoto') === 'true',
      peopleTags:
        typeof peopleTagsValue === 'string'
          ? peopleTagsValue
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      caption: typeof formData.get('caption') === 'string' ? formData.get('caption') : '',
    })

    const [bytes, person] = await Promise.all([
      file.arrayBuffer(),
      prisma.person.findUnique({
        where: { id },
        select: { id: true, dateOfBirth: true },
      }),
    ])

    if (!person) {
      return Response.json({ error: 'Person not found.' }, { status: 404 })
    }

    const extension = getImageExtension(file.name, file.type)
    const displayFileName = `${id}-${Date.now()}${extension}`
    const derivedAgeLabel = metadata.ageLabel || deriveAgeLabel(photoDate, person.dateOfBirth ?? undefined)

    const created = await prisma.photo.create({
      data: {
        url: displayFileName,
        personId: id,
        date: photoDate,
        caption: metadata.caption,
        albumCategory: metadata.albumCategory,
        ageLabel: derivedAgeLabel,
        locationLabel: metadata.locationLabel,
        isGroupPhoto: metadata.isGroupPhoto,
        peopleTags: metadata.peopleTags,
        data: Buffer.from(bytes),
        mimeType: file.type,
      },
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

    return Response.json({ success: true, photo: created })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload life-history photo.'
    return Response.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 })
  }
}
