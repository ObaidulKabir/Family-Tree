import test from 'node:test'
import assert from 'node:assert/strict'

import { splitDisplayName } from './graph'

test('splitDisplayName splits first and last name', () => {
  const result = splitDisplayName('Ada Lovelace Byron')

  assert.equal(result.firstName, 'Ada')
  assert.equal(result.lastName, 'Lovelace Byron')
})

test('splitDisplayName falls back for blank names', () => {
  const result = splitDisplayName('   ')

  assert.equal(result.firstName, 'User')
  assert.equal(result.lastName, '')
})

