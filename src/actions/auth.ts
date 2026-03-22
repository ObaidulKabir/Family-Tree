'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
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

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: "Email already in use" }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    })
    
    // Create root person for the user
    // We assume the user starts as the root node.
    const rootPerson = await prisma.person.create({
      data: {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        createdById: user.id,
        linkedUserId: user.id
      }
    })
    
    await prisma.user.update({
      where: { id: user.id },
      data: { rootPersonId: rootPerson.id }
    })
    
  } catch (error) {
    console.error(error)
    return { error: "Something went wrong during registration" }
  }
  
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
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
