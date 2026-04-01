import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPersonReviewState,
  detectFieldConflict,
  getFieldConflictDetails,
  groupClaimsByPerson,
  resolveFieldClaims,
  resolvePersonFromClaims,
  sortClaimsByAuthenticity,
  summarizeReviewQueue,
} from './resolution'

test('sortClaimsByAuthenticity prioritizes closer relationship distance', () => {
  const sorted = sortClaimsByAuthenticity([
    {
      personId: 'p1',
      field: 'firstName',
      valueJson: 'Far',
      computedDistance: 3,
      confidenceScore: 1,
      sourceType: 'USER',
      createdAt: new Date('2026-01-01'),
    },
    {
      personId: 'p1',
      field: 'firstName',
      valueJson: 'Close',
      computedDistance: 1,
      confidenceScore: 0.2,
      sourceType: 'USER',
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(sorted[0]?.valueJson, 'Close')
})

test('resolveFieldClaims prefers invitation confirmation when distance is tied', () => {
  const winner = resolveFieldClaims([
    {
      personId: 'p1',
      field: 'lastName',
      valueJson: 'Old',
      computedDistance: 0,
      confidenceScore: 1,
      sourceType: 'USER',
      createdAt: new Date('2026-01-01'),
    },
    {
      personId: 'p1',
      field: 'lastName',
      valueJson: 'Verified',
      computedDistance: 0,
      confidenceScore: 1,
      sourceType: 'INVITATION_CONFIRMATION',
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(winner?.valueJson, 'Verified')
})

test('resolvePersonFromClaims overlays winning field values on legacy person', () => {
  const resolved = resolvePersonFromClaims(
    {
      id: 'p1',
      firstName: 'Legacy',
      lastName: 'Name',
      dateOfBirth: null,
    },
    [
      {
        personId: 'p1',
        field: 'firstName',
        valueJson: 'Resolved',
        computedDistance: 0,
        confidenceScore: 1,
        sourceType: 'REGISTRATION',
        createdAt: new Date('2026-01-01'),
      },
      {
        personId: 'p1',
        field: 'dateOfBirth',
        valueJson: '2000-01-01T00:00:00.000Z',
        computedDistance: 0,
        confidenceScore: 1,
        sourceType: 'REGISTRATION',
        createdAt: new Date('2026-01-01'),
      },
    ]
  )

  assert.equal(resolved.firstName, 'Resolved')
  assert.ok(resolved.dateOfBirth instanceof Date)
  assert.equal(resolved.dateOfBirth?.toISOString(), '2000-01-01T00:00:00.000Z')
})

test('groupClaimsByPerson groups claims by person id', () => {
  const grouped = groupClaimsByPerson([
    { personId: 'p1', field: 'firstName', valueJson: 'A' },
    { personId: 'p1', field: 'lastName', valueJson: 'B' },
    { personId: 'p2', field: 'firstName', valueJson: 'C' },
  ])

  assert.equal(grouped.p1?.length, 2)
  assert.equal(grouped.p2?.length, 1)
})

test('detectFieldConflict flags equal-distance contradictory claims', () => {
  const hasConflict = detectFieldConflict([
    {
      personId: 'p1',
      field: 'lastName',
      valueJson: 'Karim',
      computedDistance: 1,
      confidenceScore: 0.7,
      createdAt: new Date('2026-01-01'),
    },
    {
      personId: 'p1',
      field: 'lastName',
      valueJson: 'Kareem',
      computedDistance: 1,
      confidenceScore: 0.6,
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(hasConflict, true)
})

test('detectFieldConflict ignores empty-string vs null equivalents', () => {
  const hasConflict = detectFieldConflict([
    {
      contributorId: 'u1',
      personId: 'p1',
      field: 'lastName',
      valueJson: '',
      computedDistance: 0,
      createdAt: new Date('2026-01-01'),
    },
    {
      contributorId: 'u1',
      personId: 'p1',
      field: 'lastName',
      valueJson: null,
      computedDistance: 0,
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(hasConflict, false)
})

test('detectFieldConflict ignores old contributor edits when a newer claim exists', () => {
  const hasConflict = detectFieldConflict([
    {
      contributorId: 'u1',
      personId: 'p1',
      field: 'dateOfDeath',
      valueJson: null,
      computedDistance: 0,
      createdAt: new Date('2026-01-01'),
    },
    {
      contributorId: 'u1',
      personId: 'p1',
      field: 'dateOfDeath',
      valueJson: '2026-03-01T00:00:00.000Z',
      computedDistance: 0,
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(hasConflict, false)
})

test('buildPersonReviewState combines claim conflicts and open links', () => {
  const reviewState = buildPersonReviewState(
    [
      {
        personId: 'p1',
        field: 'lastName',
        valueJson: 'Karim',
        computedDistance: 1,
        createdAt: new Date('2026-01-01'),
      },
      {
        personId: 'p1',
        field: 'lastName',
        valueJson: 'Kareem',
        computedDistance: 1,
        createdAt: new Date('2026-01-02'),
      },
    ],
    [
      {
        id: 'l1',
        leftPersonId: 'p1',
        rightPersonId: 'p2',
        resolutionStatus: 'OPEN',
      },
    ]
  )

  assert.equal(reviewState.needsReview, true)
  assert.deepEqual(reviewState.conflictFields, ['lastName'])
  assert.equal(reviewState.openLinkCount, 1)
  assert.equal(reviewState.status, 'needs_review')
})

test('getFieldConflictDetails returns winner and alternatives for conflicted fields', () => {
  const details = getFieldConflictDetails([
    {
      id: 'c1',
      personId: 'p1',
      field: 'placeOfBirth',
      valueJson: 'Dhaka',
      computedDistance: 1,
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'c2',
      personId: 'p1',
      field: 'placeOfBirth',
      valueJson: 'Chittagong',
      computedDistance: 1,
      createdAt: new Date('2026-01-02'),
    },
  ])

  assert.equal(details.length, 1)
  assert.equal(details[0]?.field, 'placeOfBirth')
  assert.equal(details[0]?.winner.id, 'c2')
  assert.equal(details[0]?.alternatives[0]?.id, 'c1')
})

test('summarizeReviewQueue aggregates review counts', () => {
  const summary = summarizeReviewQueue([
    {
      id: 'p1',
      reviewState: {
        conflictFields: ['lastName'],
        openLinkCount: 1,
      },
    },
    {
      id: 'p2',
      reviewState: {
        conflictFields: [],
        openLinkCount: 2,
      },
    },
  ])

  assert.equal(summary.peopleWithConflicts, 1)
  assert.equal(summary.peopleWithLinks, 2)
  assert.equal(summary.totalConflictFields, 1)
  assert.equal(summary.totalOpenLinks, 3)
})

