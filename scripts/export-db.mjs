import fs from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
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

  const outDir = process.env.EXPORT_DIR
    ? path.resolve(process.cwd(), process.env.EXPORT_DIR)
    : path.resolve(process.cwd(), 'exports')

  await fs.mkdir(outDir, { recursive: true })
  const fileName = `family-tree-export-${new Date().toISOString().replaceAll(':', '-')}.json`
  const outPath = path.join(outDir, fileName)
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')

  process.stdout.write(outPath + '\n')
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}

