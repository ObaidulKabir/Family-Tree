type FamilyLike = {
  id: string
  parent1Id?: string | null
  parent2Id?: string | null
}

export function validateExistingSpouseLink(input: {
  personId: string
  spouseId: string
  alreadySpouses: boolean
  spouseIsDirectParent: boolean
  spouseIsDirectChild: boolean
}) {
  if (input.personId === input.spouseId) {
    return { valid: false as const, error: 'Person and spouse must be different people.' }
  }

  if (input.alreadySpouses) {
    return { valid: false as const, error: 'These people are already linked as spouses.' }
  }

  if (input.spouseIsDirectParent || input.spouseIsDirectChild) {
    return { valid: false as const, error: 'A direct parent or child cannot be linked as a spouse.' }
  }

  return { valid: true as const }
}

export function validateExistingParentLink(input: {
  childId: string
  parentId: string
  alreadyParent: boolean
  childHasOpenParentSlot: boolean
  parentIsDirectChild: boolean
  parentIsDirectSpouse: boolean
}) {
  if (input.childId === input.parentId) {
    return { valid: false as const, error: 'Person and parent must be different people.' }
  }

  if (input.alreadyParent) {
    return { valid: false as const, error: 'This person is already linked as a parent.' }
  }

  if (input.parentIsDirectChild) {
    return { valid: false as const, error: 'A direct child cannot be linked as a parent.' }
  }

  if (input.parentIsDirectSpouse) {
    return { valid: false as const, error: 'A spouse cannot also be linked as a parent.' }
  }

  if (!input.childHasOpenParentSlot) {
    return { valid: false as const, error: 'Both parents are already defined for this person.' }
  }

  return { valid: true as const }
}

export function validateExistingChildLink(input: {
  parentId: string
  childId: string
  alreadyChild: boolean
  childHasConflictingFamily: boolean
  childIsDirectParent: boolean
  childIsDirectSpouse: boolean
}) {
  if (input.parentId === input.childId) {
    return { valid: false as const, error: 'Person and child must be different people.' }
  }

  if (input.alreadyChild) {
    return { valid: false as const, error: 'This person is already linked as a child.' }
  }

  if (input.childIsDirectParent) {
    return { valid: false as const, error: 'A direct parent cannot be linked as a child.' }
  }

  if (input.childIsDirectSpouse) {
    return { valid: false as const, error: 'A spouse cannot also be linked as a child.' }
  }

  if (input.childHasConflictingFamily) {
    return { valid: false as const, error: 'This person is already linked to a different parent family.' }
  }

  return { valid: true as const }
}

export function getAssociableChildrenForSpouse<T extends { childOfFamilyId?: string | null }>(
  children: T[],
  spouseFamilyId?: string | null
) {
  return children.filter((child) => child.childOfFamilyId !== spouseFamilyId)
}

export function validateChildSpouseAssociation(input: {
  parentId: string
  spouseId: string
  childId: string
  spouseFamily: FamilyLike | null
  childFamily: FamilyLike | null
}) {
  if (input.parentId === input.spouseId) {
    return { valid: false as const, error: 'Person and spouse must be different people.' }
  }

  if (input.childId === input.parentId || input.childId === input.spouseId) {
    return { valid: false as const, error: 'Selected child must be different from both parents.' }
  }

  if (!input.spouseFamily) {
    return { valid: false as const, error: 'Selected spouse is not linked to this family.' }
  }

  const spouseFamilyParentIds = [input.spouseFamily.parent1Id, input.spouseFamily.parent2Id].filter(Boolean)
  if (!spouseFamilyParentIds.includes(input.parentId) || !spouseFamilyParentIds.includes(input.spouseId)) {
    return { valid: false as const, error: 'Selected spouse is not linked to this family.' }
  }

  if (!input.childFamily) {
    return { valid: false as const, error: 'Selected child is not currently linked to this parent.' }
  }

  if (input.childFamily.id === input.spouseFamily.id) {
    return { valid: false as const, error: 'Selected child is already associated with this spouse.' }
  }

  const childFamilyParentIds = [input.childFamily.parent1Id, input.childFamily.parent2Id].filter(Boolean)
  if (!childFamilyParentIds.includes(input.parentId)) {
    return { valid: false as const, error: 'Selected child does not belong to this family unit.' }
  }

  const otherParentId =
    input.childFamily.parent1Id === input.parentId
      ? input.childFamily.parent2Id
      : input.childFamily.parent2Id === input.parentId
        ? input.childFamily.parent1Id
        : null

  if (otherParentId && otherParentId !== input.spouseId) {
    return { valid: false as const, error: 'Selected child is already assigned to a different two-parent family.' }
  }

  return { valid: true as const }
}

export function buildChildAssociationAuditDescription(input: {
  actorUserId: string
  parentId: string
  spouseId: string
  childId: string
  previousFamilyId?: string | null
  nextFamilyId: string
}) {
  return JSON.stringify({
    action: 'ASSOCIATE_CHILD_WITH_SPOUSE',
    actorUserId: input.actorUserId,
    parentId: input.parentId,
    spouseId: input.spouseId,
    childId: input.childId,
    previousFamilyId: input.previousFamilyId ?? null,
    nextFamilyId: input.nextFamilyId,
  })
}

export function buildExistingSpouseLinkAuditDescription(input: {
  actorUserId: string
  personId: string
  spouseId: string
  familyId: string
}) {
  return JSON.stringify({
    action: 'LINK_EXISTING_PERSON_AS_SPOUSE',
    actorUserId: input.actorUserId,
    personId: input.personId,
    spouseId: input.spouseId,
    familyId: input.familyId,
  })
}

export function buildExistingParentLinkAuditDescription(input: {
  actorUserId: string
  childId: string
  parentId: string
  familyId: string
}) {
  return JSON.stringify({
    action: 'LINK_EXISTING_PERSON_AS_PARENT',
    actorUserId: input.actorUserId,
    childId: input.childId,
    parentId: input.parentId,
    familyId: input.familyId,
  })
}

export function buildExistingChildLinkAuditDescription(input: {
  actorUserId: string
  parentId: string
  childId: string
  familyId: string
}) {
  return JSON.stringify({
    action: 'LINK_EXISTING_PERSON_AS_CHILD',
    actorUserId: input.actorUserId,
    parentId: input.parentId,
    childId: input.childId,
    familyId: input.familyId,
  })
}
