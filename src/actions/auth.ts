'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPersonClaims, splitDisplayName, upsertUserPersonLink } from '@/lib/graph'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'
import { AuthError } from 'next-auth'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
})

export async function register(formData: FormData) {
  const validatedFields = RegisterSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  })

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { email, password, name } = validatedFields.data
  const rawCallbackUrl = formData.get('callbackUrl')
  const callbackUrl =
    typeof rawCallbackUrl === 'string' && rawCallbackUrl.startsWith('/') ? rawCallbackUrl : '/dashboard'

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: "Email already in use" }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const { firstName, lastName } = splitDisplayName(name)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
      })

      const rootPerson = await tx.person.create({
        data: {
          firstName,
          lastName: lastName || '',
          createdById: user.id,
          linkedUserId: user.id,
        },
      })

      await tx.user.update({
        where: { id: user.id },
        data: { rootPersonId: rootPerson.id },
      })

      await tx.personLayer.create({
        data: {
          personId: rootPerson.id,
          firstName,
          lastName: lastName || '',
          contributorId: user.id,
          relationshipDistance: 0,
          confidenceScore: 1,
        },
      })

      await upsertUserPersonLink(tx, {
        userId: user.id,
        personId: rootPerson.id,
        role: 'SELF',
        status: 'ACTIVE',
        assertedDistance: 0,
        computedDistance: 0,
      })

      await createPersonClaims(tx, {
        personId: rootPerson.id,
        contributorId: user.id,
        sourceType: 'REGISTRATION',
        assertedDistance: 0,
        computedDistance: 0,
        values: {
          firstName,
          lastName: lastName || '',
        },
      })
    })
  } catch (error) {
    console.error(error)
    return { error: "Something went wrong during registration" }
  }
  
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials" }
        default:
          return { error: "Something went wrong" }
      }
    }
    throw error
  }
}
