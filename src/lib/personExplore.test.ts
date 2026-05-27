import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildResidenceMapLink,
  deriveAgeLabel,
  normalizeLivingHistory,
  sortLivingHistory,
} from './personExplore'

test('normalizeLivingHistory removes empty entries', () => {
  const entries = normalizeLivingHistory([
    { placeName: 'Dhaka', address: 'Mirpur', startDate: '2010-01-01', endDate: '2012-12-31', notes: '', latitude: '', longitude: '' },
    { placeName: '', address: '', startDate: '', endDate: '', notes: '', latitude: '', longitude: '' },
  ])

  assert.equal(entries.length, 1)
  assert.equal(entries[0].placeName, 'Dhaka')
})

test('sortLivingHistory sorts by latest start date first', () => {
  const sorted = sortLivingHistory([
    { placeName: 'A', address: '', startDate: '2000-01-01', endDate: '2005-01-01', notes: '', latitude: '', longitude: '' },
    { placeName: 'B', address: '', startDate: '2010-01-01', endDate: '2015-01-01', notes: '', latitude: '', longitude: '' },
  ])

  assert.equal(sorted[0].placeName, 'B')
})

test('buildResidenceMapLink encodes place and address', () => {
  const link = buildResidenceMapLink({
    placeName: 'Dhaka',
    address: 'Mirpur 10',
    startDate: '',
    endDate: '',
    notes: '',
    latitude: '',
    longitude: '',
  })

  assert.ok(link?.includes('Dhaka'))
  assert.ok(link?.includes('Mirpur%2010'))
})

test('deriveAgeLabel maps age to a life stage', () => {
  const label = deriveAgeLabel(new Date('2020-06-01'), new Date('2010-02-01'))
  assert.equal(label, 'Childhood')
})

