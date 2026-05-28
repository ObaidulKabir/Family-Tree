import assert from 'node:assert/strict'
import test from 'node:test'

import { getLifeStatusLabel, isDeceasedStatus, normalizeLifeStatus } from './lifeStatus'

test('normalizeLifeStatus defaults invalid values to living', () => {
  assert.equal(normalizeLifeStatus(undefined), 'LIVING')
  assert.equal(normalizeLifeStatus(''), 'LIVING')
  assert.equal(normalizeLifeStatus('something-else'), 'LIVING')
})

test('normalizeLifeStatus accepts deceased and unknown values', () => {
  assert.equal(normalizeLifeStatus('deceased'), 'DECEASED')
  assert.equal(normalizeLifeStatus('UNKNOWN'), 'UNKNOWN')
})

test('life status helpers expose deceased label correctly', () => {
  assert.equal(isDeceasedStatus('DECEASED'), true)
  assert.equal(getLifeStatusLabel('DECEASED'), 'In memory')
  assert.equal(getLifeStatusLabel('UNKNOWN'), 'Status unknown')
})
