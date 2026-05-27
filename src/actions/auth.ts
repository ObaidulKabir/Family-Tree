'use server'

import { randomBytes } from 'node:crypto'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPersonClaims, splitDisplayName, upsertUserPersonLink } from '@/lib/graph'
import {
  buildEmailVerificationLink,
  buildPasswordResetLink,
  EMAIL_VERIFICATION_TTL_MS,
  isEmailVerificationExpired,
  isPasswordResetExpired,
  normalizeEmailAddress,
  PASSWORD_RESET_TTL_MS,
  validatePasswordStrength,
} from '@/lib/passwordSecurity'
import { sendEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { headers } from 'next/headers'

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

async function createEmailVerificationSession(email: string, callbackUrl?: string | null) {
  const normalizedEmail = normalizeEmailAddress(email)

  await prisma.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  })

  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  })

  const baseUrl = await getAppBaseUrl()

  return {
    email: normalizedEmail,
    verificationLink: buildEmailVerificationLink(baseUrl, token, callbackUrl),
    expires,
  }
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

  const email = normalizeEmailAddress(validatedFields.data.email)
  const { password, name } = validatedFields.data
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

  const verification = await createEmailVerificationSession(email, callbackUrl)

  return {
    success: true,
    message: 'Account created. Verify your email address before recovering or changing your password.',
    email: verification.email,
    verificationLink: verification.verificationLink,
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
    select: { id: true, password: true, emailVerified: true },
  })

  if (!user?.password) {
    return { error: 'Password sign-in is not enabled for this account.' }
  }

  if (!user.emailVerified) {
    return { error: 'Verify your email address before changing your password.' }
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
      emailVerified: true,
      password: true,
    },
  })

  if (!user?.email || !user.password) {
    return {
      success: true,
      message: 'If an account exists for that email, a password reset email has been sent.',
    }
  }

  if (!user.emailVerified) {
    const verification = await createEmailVerificationSession(user.email)
    const verificationDelivery = await sendEmail({
      to: verification.email,
      subject: 'Verify your FamilyExplorer account',
      text: `Open this secure link to verify your email address:\n\n${verification.verificationLink}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Open this secure link to verify your email address:</p><p><a href="${verification.verificationLink}">${verification.verificationLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
    })

    if (!verificationDelivery.ok) {
      return { error: verificationDelivery.error }
    }

    return {
      success: true,
      verificationRequired: true as const,
      message: 'Verify your email address before resetting your password. We sent a verification email to your inbox.',
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

  const delivery = await sendEmail({
    to: user.email,
    subject: 'Reset your FamilyExplorer password',
    text: `Use this secure link to reset your password:\n\n${resetLink}\n\nThis link expires in 60 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this secure link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link expires in 60 minutes.</p><p>If you did not request this, you can ignore this email.</p>`,
  })

  if (!delivery.ok) {
    return { error: delivery.error }
  }

  return {
    success: true,
    message: 'If an account exists for that email, a password reset email has been sent.',
  }
}

export async function requestEmailVerification(formData: FormData) {
  const session = await auth()
  const submittedEmail = formData.get('email')
  const rawCallbackUrl = formData.get('callbackUrl')
  const callbackUrl =
    typeof rawCallbackUrl === 'string' && rawCallbackUrl.startsWith('/') ? rawCallbackUrl : null

  const normalizedEmail =
    typeof submittedEmail === 'string' && submittedEmail.trim()
      ? normalizeEmailAddress(submittedEmail)
      : null

  const user = normalizedEmail
    ? await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true, emailVerified: true },
      })
    : session?.user?.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true, email: true, emailVerified: true },
        })
      : null

  if (!user?.email) {
    return {
      success: true,
      message: 'If an account exists for that email, a verification link is now ready.',
    }
  }

  if (user.emailVerified) {
    return {
      success: true,
      alreadyVerified: true as const,
      message: 'This email address is already verified.',
      email: user.email,
    }
  }

  const verification = await createEmailVerificationSession(user.email, callbackUrl)

  return {
    success: true,
    message: 'Verification link created.',
    email: verification.email,
    verificationLink: verification.verificationLink,
  }
}

export async function getEmailVerificationTokenState(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    select: {
      identifier: true,
      expires: true,
    },
  })

  if (!verificationToken) {
    return { valid: false as const, error: 'This verification link is invalid.' }
  }

  if (isEmailVerificationExpired(verificationToken.expires)) {
    await prisma.verificationToken.deleteMany({
      where: { token },
    })
    return { valid: false as const, error: 'This verification link has expired.' }
  }

  return {
    valid: true as const,
    email: verificationToken.identifier,
    expiresAt: verificationToken.expires,
  }
}

export async function verifyEmailToken(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    select: {
      identifier: true,
      expires: true,
    },
  })

  if (!verificationToken) {
    return { error: 'This verification link is invalid.' as const }
  }

  if (isEmailVerificationExpired(verificationToken.expires)) {
    await prisma.verificationToken.deleteMany({
      where: { token },
    })
    return { error: 'This verification link has expired.' as const }
  }

  const email = normalizeEmailAddress(verificationToken.identifier)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerified: true,
    },
  })

  if (!user) {
    await prisma.verificationToken.deleteMany({
      where: { token },
    })
    return { error: 'No account was found for this verification link.' as const }
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })
  }

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  return {
    success: true as const,
    email,
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

  const user = await prisma.user.findUnique({
    where: { id: resetToken.userId },
    select: { emailVerified: true },
  })

  if (!user?.emailVerified) {
    return { error: 'Verify your email address before resetting your password.' }
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
