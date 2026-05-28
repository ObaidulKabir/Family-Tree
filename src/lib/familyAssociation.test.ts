import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildChildAssociationAuditDescription,
  buildExistingChildLinkAuditDescription,
  buildExistingParentLinkAuditDescription,
  buildExistingSpouseLinkAuditDescription,
  getAssociableChildrenForSpouse,
  validateExistingChildLink,
  validateExistingParentLink,
  validateExistingSpouseLink,
  validateChildSpouseAssociation,
  validateChildSpouseReassignment,
} from './familyAssociation'

test('getAssociableChildrenForSpouse excludes children already linked to the spouse family', () => {
  const children = getAssociableChildrenForSpouse(
    [
      { id: 'c1', childOfFamilyId: 'f1' },
      { id: 'c2', childOfFamilyId: 'f2' },
      { id: 'c3', childOfFamilyId: null },
    ],
    'f2'
  )

  assert.deepEqual(children.map((child) => child.id), ['c1', 'c3'])
})

test('validateChildSpouseAssociation accepts moving a single-parent child into the spouse family', () => {
  const result = validateChildSpouseAssociation({
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    spouseFamily: { id: 'f2', parent1Id: 'p1', parent2Id: 'p2' },
    childFamily: { id: 'f1', parent1Id: 'p1', parent2Id: null },
  })

  assert.equal(result.valid, true)
})

test('validateChildSpouseAssociation rejects children already assigned to a different two-parent family', () => {
  const result = validateChildSpouseAssociation({
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    spouseFamily: { id: 'f2', parent1Id: 'p1', parent2Id: 'p2' },
    childFamily: { id: 'f1', parent1Id: 'p1', parent2Id: 'p3' },
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'Selected child is already assigned to a different two-parent family.')
})

test('validateChildSpouseAssociation rejects a spouse outside the current family unit', () => {
  const result = validateChildSpouseAssociation({
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    spouseFamily: { id: 'f2', parent1Id: 'p1', parent2Id: 'p9' },
    childFamily: { id: 'f1', parent1Id: 'p1', parent2Id: null },
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'Selected spouse is not linked to this family.')
})

test('validateChildSpouseReassignment allows moving a child between two-parent families', () => {
  const result = validateChildSpouseReassignment({
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    spouseFamily: { id: 'f2', parent1Id: 'p1', parent2Id: 'p2' },
    childFamily: { id: 'f1', parent1Id: 'p1', parent2Id: 'p3' },
  })

  assert.equal(result.valid, true)
})

test('buildChildAssociationAuditDescription records the association metadata', () => {
  const description = buildChildAssociationAuditDescription({
    actorUserId: 'u1',
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    previousFamilyId: 'f1',
    nextFamilyId: 'f2',
  })

  assert.deepEqual(JSON.parse(description), {
    action: 'ASSOCIATE_CHILD_WITH_SPOUSE',
    actorUserId: 'u1',
    parentId: 'p1',
    spouseId: 'p2',
    childId: 'c1',
    previousFamilyId: 'f1',
    nextFamilyId: 'f2',
  })
})

test('validateExistingSpouseLink accepts a valid existing-person spouse link', () => {
  const result = validateExistingSpouseLink({
    personId: 'p1',
    spouseId: 'p2',
    alreadySpouses: false,
    spouseIsDirectParent: false,
    spouseIsDirectChild: false,
  })

  assert.equal(result.valid, true)
})

test('validateExistingSpouseLink rejects duplicate spouse links', () => {
  const result = validateExistingSpouseLink({
    personId: 'p1',
    spouseId: 'p2',
    alreadySpouses: true,
    spouseIsDirectParent: false,
    spouseIsDirectChild: false,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'These people are already linked as spouses.')
})

test('validateExistingSpouseLink rejects direct parent-child spouse links', () => {
  const result = validateExistingSpouseLink({
    personId: 'p1',
    spouseId: 'p2',
    alreadySpouses: false,
    spouseIsDirectParent: true,
    spouseIsDirectChild: false,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'A direct parent or child cannot be linked as a spouse.')
})

test('buildExistingSpouseLinkAuditDescription records spouse link metadata', () => {
  const description = buildExistingSpouseLinkAuditDescription({
    actorUserId: 'u1',
    personId: 'p1',
    spouseId: 'p2',
    familyId: 'f1',
  })

  assert.deepEqual(JSON.parse(description), {
    action: 'LINK_EXISTING_PERSON_AS_SPOUSE',
    actorUserId: 'u1',
    personId: 'p1',
    spouseId: 'p2',
    familyId: 'f1',
  })
})

test('validateExistingParentLink accepts a valid parent link', () => {
  const result = validateExistingParentLink({
    childId: 'c1',
    parentId: 'p1',
    alreadyParent: false,
    childHasOpenParentSlot: true,
    parentIsDirectChild: false,
    parentIsDirectSpouse: false,
  })

  assert.equal(result.valid, true)
})

test('validateExistingParentLink rejects when both parents already exist', () => {
  const result = validateExistingParentLink({
    childId: 'c1',
    parentId: 'p1',
    alreadyParent: false,
    childHasOpenParentSlot: false,
    parentIsDirectChild: false,
    parentIsDirectSpouse: false,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'Both parents are already defined for this person.')
})

test('validateExistingChildLink rejects children from a conflicting family', () => {
  const result = validateExistingChildLink({
    parentId: 'p1',
    childId: 'c1',
    alreadyChild: false,
    childHasConflictingFamily: true,
    childIsDirectParent: false,
    childIsDirectSpouse: false,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'This person is already linked to a different parent family.')
})

test('validateExistingChildLink accepts a valid child link', () => {
  const result = validateExistingChildLink({
    parentId: 'p1',
    childId: 'c1',
    alreadyChild: false,
    childHasConflictingFamily: false,
    childIsDirectParent: false,
    childIsDirectSpouse: false,
  })

  assert.equal(result.valid, true)
})

test('buildExistingParentLinkAuditDescription records parent link metadata', () => {
  const description = buildExistingParentLinkAuditDescription({
    actorUserId: 'u1',
    childId: 'c1',
    parentId: 'p1',
    familyId: 'f1',
  })

  assert.deepEqual(JSON.parse(description), {
    action: 'LINK_EXISTING_PERSON_AS_PARENT',
    actorUserId: 'u1',
    childId: 'c1',
    parentId: 'p1',
    familyId: 'f1',
  })
})

test('buildExistingChildLinkAuditDescription records child link metadata', () => {
  const description = buildExistingChildLinkAuditDescription({
    actorUserId: 'u1',
    parentId: 'p1',
    childId: 'c1',
    familyId: 'f1',
  })

  assert.deepEqual(JSON.parse(description), {
    action: 'LINK_EXISTING_PERSON_AS_CHILD',
    actorUserId: 'u1',
    parentId: 'p1',
    childId: 'c1',
    familyId: 'f1',
  })
})
