import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { auth } from '@/auth'
import { getImageExtension, validateImageUpload } from '@/lib/upload'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded.' }, { status: 400 })
  }

  const validation = validateImageUpload({
    mimeType: file.type,
    size: file.size,
  })

  if (!validation.valid) {
    return Response.json({ error: validation.error }, { status: 400 })
  }

  const uploadsDirectory = path.join(process.cwd(), 'public', 'uploads', 'people')
  await mkdir(uploadsDirectory, { recursive: true })

  const extension = getImageExtension(file.name, file.type)
  const fileName = `${randomUUID()}${extension}`
  const filePath = path.join(uploadsDirectory, fileName)
  const bytes = await file.arrayBuffer()

  await writeFile(filePath, Buffer.from(bytes))

  return Response.json({
    success: true,
    url: `/uploads/people/${fileName}`,
  })
}

