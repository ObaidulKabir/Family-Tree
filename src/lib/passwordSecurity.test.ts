import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPasswordResetLink,
  isPasswordResetExpired,
  normalizeEmailAddress,
  validatePasswordStrength,
} from './passwordSecurity'

test('normalizeEmailAddress trims and lowercases email addresses', () => {
  assert.equal(normalizeEmailAddress('  USER@Example.COM '), 'user@example.com')
})

test('validatePasswordStrength rejects short passwords', () => {
  const result = validatePasswordStrength('abc123')
  assert.equal(result.valid, false)
  assert.equal(result.error, 'Password must be at least 8 characters long.')
})

test('validatePasswordStrength rejects passwords without letters and numbers', () => {
  const result = validatePasswordStrength('abcdefgh')
  assert.equal(result.valid, false)
  assert.equal(result.error, 'Password must include at least one letter and one number.')
})

test('validatePasswordStrength accepts stronger passwords', () => {
  const result = validatePasswordStrength('family2026')
  assert.equal(result.valid, true)
})

test('isPasswordResetExpired compares the expiry timestamp', () => {
  const now = new Date('2026-04-03T12:00:00.000Z')
  assert.equal(isPasswordResetExpired(new Date('2026-04-03T11:59:59.000Z'), now), true)
  assert.equal(isPasswordResetExpired(new Date('2026-04-03T12:30:00.000Z'), now), false)
})

test('buildPasswordResetLink creates a reset-password route URL', () => {
  assert.equal(
    buildPasswordResetLink('http://localhost:3000/', 'token-123'),
    'http://localhost:3000/reset-password/token-123'
  )
})

