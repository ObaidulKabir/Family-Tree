import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildGraphAuditDetails,
  canEditGraph,
  canInviteGraph,
  canInviteGraphRole,
  canManageGraph,
  canViewGraph,
  getAllowedInviteRoles,
  getContributorPresence,
  isGraphInvitationExpired,
  validateOptimisticConcurrency,
} from './graphManagement'

test('graph roles expose view/edit/manage capabilities correctly', () => {
  assert.equal(canViewGraph('VIEWER'), true)
  assert.equal(canEditGraph('EDITOR'), true)
  assert.equal(canManageGraph('ADMIN'), true)
  assert.equal(canManageGraph('OWNER'), true)
  assert.equal(canEditGraph('VIEWER'), false)
  assert.equal(canManageGraph('EDITOR'), false)
})

test('graph roles expose invite capabilities correctly', () => {
  assert.equal(canInviteGraph('ADMIN'), true)
  assert.equal(canInviteGraph('OWNER'), true)
  assert.equal(canInviteGraph('EDITOR'), true)
  assert.equal(canInviteGraph('VIEWER'), true)
  assert.deepEqual(getAllowedInviteRoles('ADMIN'), ['EDITOR', 'COMMENTER', 'VIEWER'])
  assert.deepEqual(getAllowedInviteRoles('OWNER'), ['EDITOR', 'COMMENTER', 'VIEWER'])
  assert.deepEqual(getAllowedInviteRoles('EDITOR'), ['EDITOR', 'VIEWER'])
  assert.deepEqual(getAllowedInviteRoles('COMMENTER'), ['VIEWER'])
  assert.deepEqual(getAllowedInviteRoles('VIEWER'), ['VIEWER'])
  assert.equal(canInviteGraphRole('EDITOR', 'EDITOR'), true)
  assert.equal(canInviteGraphRole('EDITOR', 'VIEWER'), true)
  assert.equal(canInviteGraphRole('EDITOR', 'COMMENTER'), false)
  assert.equal(canInviteGraphRole('VIEWER', 'VIEWER'), true)
  assert.equal(canInviteGraphRole('VIEWER', 'EDITOR'), false)
})

test('expired graph invitations are detected from expiry time', () => {
  const now = new Date('2026-04-03T12:00:00.000Z')
  assert.equal(isGraphInvitationExpired(new Date('2026-04-03T11:59:59.000Z'), now), true)
  assert.equal(isGraphInvitationExpired(new Date('2026-04-03T12:30:00.000Z'), now), false)
})

test('contributor presence distinguishes online away and offline states', () => {
  const now = new Date('2026-04-03T12:00:00.000Z')
  assert.equal(getContributorPresence(new Date('2026-04-03T11:59:00.000Z'), now), 'online')
  assert.equal(getContributorPresence(new Date('2026-04-03T11:40:00.000Z'), now), 'away')
  assert.equal(getContributorPresence(new Date('2026-04-03T11:00:00.000Z'), now), 'offline')
})

test('optimistic concurrency rejects stale updates', () => {
  const result = validateOptimisticConcurrency({
    currentUpdatedAt: new Date('2026-04-03T12:00:00.000Z'),
    expectedUpdatedAt: new Date('2026-04-03T11:59:59.000Z'),
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'This record was updated by another contributor. Refresh and try again.')
})

test('buildGraphAuditDetails serializes graph management audit payloads', () => {
  const payload = buildGraphAuditDetails('INVITATION_CREATED', {
    graphId: 'g1',
    email: 'test@example.com',
    role: 'EDITOR',
  })

  assert.deepEqual(JSON.parse(payload), {
    action: 'INVITATION_CREATED',
    graphId: 'g1',
    email: 'test@example.com',
    role: 'EDITOR',
  })
})

