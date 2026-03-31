import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const url = process.env.DATABASE_URL ?? ''
  process.stdout.write(`DATABASE_URL=${url}\n`)

  const tables = await prisma.$queryRawUnsafe(
    "select tablename from pg_tables where schemaname='public' order by tablename"
  )
  process.stdout.write(`public tables: ${JSON.stringify(tables)}\n`)

  const migrations = await prisma.$queryRawUnsafe(
    "select tablename from pg_tables where schemaname='public' and tablename='_prisma_migrations'"
  )
  process.stdout.write(`has _prisma_migrations: ${JSON.stringify(migrations)}\n`)

  const userCount = await prisma.user.count()
  process.stdout.write(`User count: ${userCount}\n`)
} finally {
  await prisma.$disconnect()
}

