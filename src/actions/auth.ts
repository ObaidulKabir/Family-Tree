'use server'

import { randomBytes } from 'node:crypto'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPersonClaims, splitDisplayName, upsertUserPersonLink } from '@/lib/graph'
import {
  buildPasswordResetLink,
  isPasswordResetExpired,
  normalizeEmailAddress,
  PASSWORD_RESET_TTL_MS,
  validatePasswordStrength,
} from '@/lib/passwordSecurity'
import bcrypt from 'bcryptjs'
import { auth, signIn } from '@/auth'
import { headers } from 'next/headers'
import { AuthError } from 'next-auth'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1),
})

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
})

async function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'

  if (host) {
    return `${protocol}://${host}`
  }

  return 'http://localhost:3000'
}

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

export async function changePassword(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const validatedFields = ChangePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { currentPassword, newPassword, confirmPassword } = validatedFields.data

  if (newPassword !== confirmPassword) {
    return { error: 'New password and confirmation do not match.' }
  }

  const passwordValidation = validatePasswordStrength(newPassword)
  if (!passwordValidation.valid) {
    return { error: passwordValidation.error }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  })

  if (!user?.password) {
    return { error: 'Password sign-in is not enabled for this account.' }
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isCurrentPasswordValid) {
    return { error: 'Current password is incorrect.' }
  }

  if (currentPassword === newPassword) {
    return { error: 'New password must be different from the current password.' }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  })

  return { success: true }
}

export async function requestPasswordReset(formData: FormData) {
  const validatedFields = ForgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!validatedFields.success) {
    return { error: 'Enter a valid email address.' }
  }

  const email = normalizeEmailAddress(validatedFields.data.email)

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
    },
  })

  if (!user?.email || !user.password) {
    return {
      success: true,
      message: 'If an account exists for that email, a reset link is now ready.',
    }
  }

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      email: user.email,
      token,
      expiresAt,
    },
  })

  const baseUrl = await getAppBaseUrl()
  const resetLink = buildPasswordResetLink(baseUrl, token)

  return {
    success: true,
    message: 'Password reset link created.',
    email: user.email,
    resetLink,
  }
}

export async function getPasswordResetTokenState(token: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: {
      email: true,
      expiresAt: true,
      consumedAt: true,
    },
  })

  if (!resetToken) {
    return { valid: false as const, error: 'This password reset link is invalid.' }
  }

  if (resetToken.consumedAt) {
    return { valid: false as const, error: 'This password reset link has already been used.' }
  }

  if (isPasswordResetExpired(resetToken.expiresAt)) {
    return { valid: false as const, error: 'This password reset link has expired.' }
  }

  return {
    valid: true as const,
    email: resetToken.email,
    expiresAt: resetToken.expiresAt,
  }
}

export async function resetPassword(formData: FormData) {
  const validatedFields = ResetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { token, password, confirmPassword } = validatedFields.data

  if (password !== confirmPassword) {
    return { error: 'Password and confirmation do not match.' }
  }

  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.valid) {
    return { error: passwordValidation.error }
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
    },
  })

  if (!resetToken) {
    return { error: 'This password reset link is invalid.' }
  }

  if (resetToken.consumedAt) {
    return { error: 'This password reset link has already been used.' }
  }

  if (isPasswordResetExpired(resetToken.expiresAt)) {
    return { error: 'This password reset link has expired.' }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { consumedAt: new Date() },
    })

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        consumedAt: null,
        id: { not: resetToken.id },
      },
      data: { consumedAt: new Date() },
    })
  })

  return { success: true }
}
