export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase()
}

export function validatePasswordStrength(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false as const, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` }
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { valid: false as const, error: 'Password must include at least one letter and one number.' }
  }

  return { valid: true as const }
}

export function isPasswordResetExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime()
}

export function isEmailVerificationExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime()
}

export function buildPasswordResetLink(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/$/, '')}/reset-password/${token}`
}

export function buildEmailVerificationLink(baseUrl: string, token: string, callbackUrl?: string | null) {
  const url = new URL(`/verify-email/${token}`, `${baseUrl.replace(/\/$/, '')}/`)
  if (callbackUrl && callbackUrl.startsWith('/')) {
    url.searchParams.set('callbackUrl', callbackUrl)
  }
  return url.toString()
}

