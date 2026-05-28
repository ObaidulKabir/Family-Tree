'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { computeRelationshipDistance, createPersonClaims, createRelationshipClaim, upsertUserPersonLink } from '@/lib/graph'
import { canEditGraph, canManageGraph, validateOptimisticConcurrency } from '@/lib/graphManagement'
import { normalizeLifeStatus } from '@/lib/lifeStatus'
import { normalizeEducationHistory, normalizeProfessionalHistory } from '@/lib/personHistory'
import {
    buildChildAssociationAuditDescription,
    buildExistingChildLinkAuditDescription,
    buildExistingParentLinkAuditDescription,
    buildExistingSpouseLinkAuditDescription,
    validateChildSpouseAssociation,
    validateChildSpouseReassignment,
    validateExistingChildLink,
    validateExistingParentLink,
    validateExistingSpouseLink
} from '@/lib/familyAssociation'
import { buildPersonReviewState, groupClaimsByPerson, resolvePersonFromClaims, summarizeReviewQueue } from '@/lib/resolution'
import { createGraphAuditEntry, getCurrentGraphContext, requireGraphPermissionForPerson } from '@/actions/graphManagement'
import { authorizePersonAccessInGraph } from '@/lib/collab/authorize'
import { revalidatePath } from 'next/cache'

async function ensurePersonEditableInGraph(userId: string, personId: string, graphId: string) {
  const authorization = await authorizePersonAccessInGraph(prisma, {
    userId,
    personId,
    graphId,
    mode: 'edit',
  })

  if (authorization.branchScope.checked && !authorization.branchScope.inScope && authorization.branchScope.mode === 'observe') {
    await prisma.graphAuditLog.create({
      data: {
        graphId: authorization.context.graphId,
        actorUserId: userId,
        actorMembershipId: authorization.context.membershipId,
        actorRole: authorization.context.role,
        actorTrustLevel: authorization.context.trustLevel,
        action: 'BRANCH_SCOPE_WOULD_DENY',
        entityType: 'PERSON',
        entityId: personId,
        detailsJson: {
          scopeMode: authorization.context.scopeMode,
        },
      },
    })
  }

  return authorization
}

export async function getPersonDetails(personId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!session.user.id) return { error: "Unauthorized" }

  const graphContext = await requireGraphPermissionForPerson(prisma, session.user.id, personId, 'view')

  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
        events: true, 
        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } },
        childOfFamily: {
            include: {
                parent1: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                parent2: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                }
            }
        },
        familiesAsParent1: {
            include: {
                parent1: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                parent2: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                children: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                events: true
            }
        },
        familiesAsParent2: {
            include: {
                parent1: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                parent2: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                children: {
                    include: {
                        photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                    }
                },
                events: true
            }
        }
    }
  })

  if (!person) return { error: "Person not found" }

  // Parents
  const parents: Array<Record<string, unknown> & { id: string }> = [];
  if (person.childOfFamily) {
      if (person.childOfFamily.parent1) parents.push(person.childOfFamily.parent1);
      if (person.childOfFamily.parent2) parents.push(person.childOfFamily.parent2);
  }

  // Spouses
  const allFamilies = [...person.familiesAsParent1, ...person.familiesAsParent2];
  
  const spouses = allFamilies.map(f => {
      const isParent1 = f.parent1Id === person.id;
      const spouse = isParent1 ? f.parent2 : f.parent1;
      
      if (!spouse) return null;

      const divorceEvent = f.events.find((e: { type: string }) => e.type === 'DIVORCE');
      const marriageEvent = f.events.find((e: { type: string }) => e.type === 'MARRIAGE');

      return { 
          ...spouse, 
          familyId: f.id,
          marriageDate: marriageEvent?.date,
          marriagePlace: marriageEvent?.place,
          marriageId: marriageEvent?.id,
          isDivorced: !!divorceEvent,
          divorceDate: divorceEvent?.date,
          divorcePlace: divorceEvent?.place,
          divorceId: divorceEvent?.id
      };
  }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  // Children
  const children = allFamilies.flatMap(f => f.children);

  // Siblings
  let siblings: Array<Record<string, unknown> & { id: string }> = [];
  if (person.childOfFamilyId) {
      const family = await prisma.family.findUnique({
          where: { id: person.childOfFamilyId },
          include: {
              children: {
                  include: {
                      photos: { orderBy: { createdAt: 'desc' }, select: { id: true, url: true, date: true } }
                  }
              }
          }
      });
      if (family) {
          siblings = family.children.filter((c: { id: string }) => c.id !== person.id);
      }
  }

  const relatedPeople = [
      person,
      ...parents,
      ...spouses,
      ...children,
      ...siblings
  ].filter((candidate): candidate is { id: string } => Boolean(candidate && typeof candidate === 'object' && 'id' in candidate))

  const uniquePersonIds = [...new Set(relatedPeople.map((candidate) => candidate.id))]

  const claims = await prisma.personClaim.findMany({
      where: {
          personId: { in: uniquePersonIds },
          resolutionStatus: { not: 'REJECTED' }
      },
      orderBy: { createdAt: 'asc' }
  })

  const personLinks = await prisma.personLink.findMany({
      where: {
          OR: [
              { leftPersonId: { in: uniquePersonIds } },
              { rightPersonId: { in: uniquePersonIds } }
          ]
      }
  })

  const claimsByPerson = groupClaimsByPerson(claims)
  const resolvePerson = <TPerson extends { id: string }>(candidate: TPerson) => {
      const relatedLinks = personLinks.filter((link) => link.leftPersonId === candidate.id || link.rightPersonId === candidate.id)
      const reviewState = buildPersonReviewState(claimsByPerson[candidate.id] ?? [], relatedLinks)
      return {
          ...resolvePersonFromClaims(candidate, claimsByPerson[candidate.id] ?? []),
          reviewState
      }
  }

  const resolvedPerson = resolvePerson(person)
  const resolvedParents = parents.map((candidate) => resolvePerson(candidate))
  const resolvedSpouses = spouses.map((candidate) => resolvePerson(candidate))
  const resolvedChildren = children.map((candidate) => resolvePerson(candidate))
  const resolvedSiblings = siblings.map((candidate) => resolvePerson(candidate))

  const reviewSummary = summarizeReviewQueue([
      resolvedPerson,
      ...resolvedParents,
      ...resolvedSpouses,
      ...resolvedChildren,
      ...resolvedSiblings
  ])

  return {
      person: resolvedPerson,
      parents: resolvedParents,
      spouses: resolvedSpouses,
      children: resolvedChildren,
      siblings: resolvedSiblings,
      reviewSummary,
      graphPermission: {
        graphId: graphContext.graphId,
        role: graphContext.role,
        canEdit: canEditGraph(graphContext.role),
        canManage: canManageGraph(graphContext.role),
      }
  };
}

export async function addPerson(
    data: { firstName: string; lastName?: string; gender?: string; dateOfBirth?: Date; placeOfBirth?: string; marriageDate?: Date }, 
    relationToId: string, 
    relationType: 'PARENT' | 'CHILD' | 'SPOUSE'
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, relationToId, 'edit')

    try {
        const newPerson = await prisma.$transaction(async (tx) => {
            const createdPerson = await tx.person.create({
                data: {
                    graphId: graphContext.graphId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    createdById: userId
                }
            });

            if (relationType === 'PARENT') {
                const child = await tx.person.findUnique({
                    where: { id: relationToId },
                    include: { childOfFamily: true }
                });

                if (!child) {
                    throw new Error("Child not found");
                }

                if (child.childOfFamily) {
                    const family = child.childOfFamily;
                    if (!family.parent1Id) {
                        await tx.family.update({
                            where: { id: family.id },
                            data: { parent1Id: createdPerson.id }
                        });
                    } else if (!family.parent2Id) {
                        await tx.family.update({
                            where: { id: family.id },
                            data: { parent2Id: createdPerson.id }
                        });
                    } else {
                        throw new Error("Both parents already defined");
                    }
                } else {
                    await tx.family.create({
                        data: {
                            graphId: graphContext.graphId,
                            parent1Id: createdPerson.id,
                            children: { connect: { id: child.id } }
                        }
                    });
                }

                const distance = await computeRelationshipDistance(tx, userId, createdPerson.id);

                await createRelationshipClaim(tx, {
                    fromPersonId: createdPerson.id,
                    toPersonId: child.id,
                    relationshipType: 'BIO_PARENT',
                    contributorId: userId,
                    computedDistance: distance,
                });
                await createRelationshipClaim(tx, {
                    fromPersonId: child.id,
                    toPersonId: createdPerson.id,
                    relationshipType: 'CHILD',
                    contributorId: userId,
                    computedDistance: distance,
                });

                await tx.personLayer.create({
                    data: {
                        personId: createdPerson.id,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        gender: data.gender,
                        dateOfBirth: data.dateOfBirth,
                        placeOfBirth: data.placeOfBirth,
                        contributorId: userId,
                        relationshipDistance: distance ?? undefined,
                        confidenceScore: 1.0
                    }
                });

                await createPersonClaims(tx, {
                    personId: createdPerson.id,
                    contributorId: userId,
                    sourceType: 'USER',
                    computedDistance: distance,
                    values: {
                        firstName: data.firstName,
                        lastName: data.lastName ?? null,
                        gender: data.gender ?? null,
                        dateOfBirth: data.dateOfBirth ?? null,
                        placeOfBirth: data.placeOfBirth ?? null,
                    },
                });

                await upsertUserPersonLink(tx, {
                    userId,
                    personId: createdPerson.id,
                    role: 'CONTRIBUTOR',
                    status: 'ACTIVE',
                    computedDistance: distance,
                });

                return createdPerson;
            }

            if (relationType === 'CHILD') {
                const parent = await tx.person.findUnique({
                    where: { id: relationToId },
                    include: { familiesAsParent1: true, familiesAsParent2: true }
                });

                if (!parent) {
                    throw new Error("Parent not found");
                }

                const families = [...parent.familiesAsParent1, ...parent.familiesAsParent2];

                if (families.length > 0) {
                    await tx.family.update({
                        where: { id: families[0].id },
                        data: { children: { connect: { id: createdPerson.id } } }
                    });
                } else {
                    await tx.family.create({
                        data: {
                            graphId: graphContext.graphId,
                            parent1Id: parent.id,
                            children: { connect: { id: createdPerson.id } }
                        }
                    });
                }

                const distance = await computeRelationshipDistance(tx, userId, createdPerson.id);

                await createRelationshipClaim(tx, {
                    fromPersonId: parent.id,
                    toPersonId: createdPerson.id,
                    relationshipType: 'BIO_PARENT',
                    contributorId: userId,
                    computedDistance: distance,
                });
                await createRelationshipClaim(tx, {
                    fromPersonId: createdPerson.id,
                    toPersonId: parent.id,
                    relationshipType: 'CHILD',
                    contributorId: userId,
                    computedDistance: distance,
                });

                await tx.personLayer.create({
                    data: {
                        personId: createdPerson.id,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        gender: data.gender,
                        dateOfBirth: data.dateOfBirth,
                        placeOfBirth: data.placeOfBirth,
                        contributorId: userId,
                        relationshipDistance: distance ?? undefined,
                        confidenceScore: 1.0
                    }
                });

                await createPersonClaims(tx, {
                    personId: createdPerson.id,
                    contributorId: userId,
                    sourceType: 'USER',
                    computedDistance: distance,
                    values: {
                        firstName: data.firstName,
                        lastName: data.lastName ?? null,
                        gender: data.gender ?? null,
                        dateOfBirth: data.dateOfBirth ?? null,
                        placeOfBirth: data.placeOfBirth ?? null,
                    },
                });

                await upsertUserPersonLink(tx, {
                    userId,
                    personId: createdPerson.id,
                    role: 'CONTRIBUTOR',
                    status: 'ACTIVE',
                    computedDistance: distance,
                });

                return createdPerson;
            }

            await tx.family.create({
                data: {
                    graphId: graphContext.graphId,
                    parent1Id: relationToId,
                    parent2Id: createdPerson.id,
                    events: data.marriageDate ? {
                        create: {
                            type: 'MARRIAGE',
                            date: data.marriageDate
                        }
                    } : undefined
                }
            });

            const distance = await computeRelationshipDistance(tx, userId, createdPerson.id);

            await createRelationshipClaim(tx, {
                fromPersonId: relationToId,
                toPersonId: createdPerson.id,
                relationshipType: 'SPOUSE',
                contributorId: userId,
                computedDistance: distance,
            });
            await createRelationshipClaim(tx, {
                fromPersonId: createdPerson.id,
                toPersonId: relationToId,
                relationshipType: 'SPOUSE',
                contributorId: userId,
                computedDistance: distance,
            });

            await tx.personLayer.create({
                data: {
                    personId: createdPerson.id,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    contributorId: userId,
                    relationshipDistance: distance ?? undefined,
                    confidenceScore: 1.0
                }
            });

            await createPersonClaims(tx, {
                personId: createdPerson.id,
                contributorId: userId,
                sourceType: 'USER',
                computedDistance: distance,
                values: {
                    firstName: data.firstName,
                    lastName: data.lastName ?? null,
                    gender: data.gender ?? null,
                    dateOfBirth: data.dateOfBirth ?? null,
                    placeOfBirth: data.placeOfBirth ?? null,
                },
            });

            await upsertUserPersonLink(tx, {
                userId,
                personId: createdPerson.id,
                role: 'CONTRIBUTOR',
                status: 'ACTIVE',
                computedDistance: distance,
            });

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'PERSON_CREATED',
                entityType: 'PERSON',
                entityId: createdPerson.id,
                details: {
                    relationType,
                    relationToId,
                },
            })

            return createdPerson;
        });

        revalidatePath('/dashboard');
        return { success: true, person: newPerson };

    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to add person" };
    }
}

export async function searchPeopleForRelationship(query?: string, excludePersonId?: string) {
    const session = await auth()
    if (!session?.user?.id) return { people: [], error: 'Unauthorized' as const }

    const trimmedQuery = query?.trim()

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, rootPersonId: true }
    })

    if (!user?.rootPersonId) {
        return { people: [], error: null }
    }

    const graphContext = await getCurrentGraphContext(
        user.id,
        user.name ?? session.user.name ?? 'User',
        user.rootPersonId
    )

    if (!graphContext.graphId) {
        return { people: [], error: null }
    }

    const people = await prisma.person.findMany({
        where: {
            graphId: graphContext.graphId,
            id: excludePersonId ? { not: excludePersonId } : undefined,
            ...(trimmedQuery ? {
                OR: [
                    { firstName: { contains: trimmedQuery, mode: 'insensitive' } },
                    { lastName: { contains: trimmedQuery, mode: 'insensitive' } },
                    { nickName: { contains: trimmedQuery, mode: 'insensitive' } }
                ]
            } : {})
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickName: true,
            dateOfBirth: true,
        },
        orderBy: [
            { firstName: 'asc' },
            { lastName: 'asc' }
        ],
        take: 25
    })

    return {
        people: people.map((person) => ({
            ...person,
            computedDistance: null
        })),
        error: null
    }
}

export async function searchPeopleInCurrentGraph(query?: string) {
    const session = await auth()
    if (!session?.user?.id) return { people: [], error: 'Unauthorized' as const }

    const trimmedQuery = query?.trim()
    if (!trimmedQuery) {
        return { people: [], error: null }
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, rootPersonId: true }
    })

    if (!user?.rootPersonId) {
        return { people: [], error: null }
    }

    const graphContext = await getCurrentGraphContext(
        user.id,
        user.name ?? session.user.name ?? 'User',
        user.rootPersonId
    )

    if (!graphContext.graphId) {
        return { people: [], error: null }
    }

    const people = await prisma.person.findMany({
        where: {
            graphId: graphContext.graphId,
            OR: [
                { firstName: { contains: trimmedQuery, mode: 'insensitive' } },
                { lastName: { contains: trimmedQuery, mode: 'insensitive' } },
                { nickName: { contains: trimmedQuery, mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickName: true,
            dateOfBirth: true,
        },
        orderBy: [
            { firstName: 'asc' },
            { lastName: 'asc' }
        ],
        take: 15
    })

    return { people, error: null }
}

export async function updatePerson(
    personId: string,
    data: { 
        firstName: string; 
        lastName?: string; 
        middleName?: string;
        nickName?: string;
        gender?: string; 
        lifeStatus?: string;
        educationHistory?: unknown;
        professionalHistory?: unknown;
        dateOfBirth?: Date; 
        placeOfBirth?: string;
        dateOfDeath?: Date | null;
        placeOfDeath?: string | null;
        title?: string;
        photoUrl?: string;
        photoDate?: Date;
        replacePhoto?: boolean;
        removePhoto?: boolean;
        lastKnownUpdatedAt?: Date;
    }
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return { error: "Person not found" };
    
    try {
        const distance = await computeRelationshipDistance(prisma, userId, personId);
        const educationHistory = normalizeEducationHistory(data.educationHistory)
        const professionalHistory = normalizeProfessionalHistory(data.professionalHistory)
        const lifeStatus = normalizeLifeStatus(data.lifeStatus ?? person.lifeStatus)
        const deathDate = lifeStatus === 'DECEASED' ? data.dateOfDeath ?? null : null
        const deathPlace = lifeStatus === 'DECEASED' ? data.placeOfDeath ?? null : null

        await prisma.$transaction(async (tx) => {
            const concurrency = validateOptimisticConcurrency({
                currentUpdatedAt: person.updatedAt,
                expectedUpdatedAt: data.lastKnownUpdatedAt,
            })

            if (!concurrency.valid) {
                throw new Error(concurrency.error)
            }

            await tx.personLayer.create({
                data: {
                    personId: personId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    middleName: data.middleName,
                    nickName: data.nickName,
                    gender: data.gender,
                    lifeStatus,
                    educationHistory,
                    professionalHistory,
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    dateOfDeath: deathDate,
                    placeOfDeath: deathPlace,
                    title: data.title,
                    contributorId: userId,
                    relationshipDistance: distance ?? undefined
                }
            });

            await createPersonClaims(tx, {
                personId,
                contributorId: userId,
                sourceType: 'USER',
                computedDistance: distance,
                values: {
                    firstName: data.firstName,
                    lastName: data.lastName ?? null,
                    middleName: data.middleName ?? null,
                    nickName: data.nickName ?? null,
                    gender: data.gender ?? null,
                    lifeStatus,
                    dateOfBirth: data.dateOfBirth ?? null,
                    placeOfBirth: data.placeOfBirth ?? null,
                    dateOfDeath: deathDate,
                    placeOfDeath: deathPlace,
                    title: data.title ?? null,
                },
            });

            await upsertUserPersonLink(tx, {
                userId,
                personId,
                role: distance === 0 ? 'SELF' : 'CONTRIBUTOR',
                status: 'ACTIVE',
                computedDistance: distance,
            });

            await tx.person.update({
                where: { id: personId },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    middleName: data.middleName,
                    nickName: data.nickName,
                    gender: data.gender,
                    lifeStatus,
                    educationHistory,
                    professionalHistory,
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    dateOfDeath: deathDate,
                    placeOfDeath: deathPlace,
                    title: data.title
                }
            });
            
            if (lifeStatus === 'DECEASED') {
                const deathEvent = await tx.familyEvent.findFirst({
                    where: {
                        type: 'DEATH',
                        personId: personId
                    }
                });

                if (deathEvent) {
                    await tx.familyEvent.update({
                        where: { id: deathEvent.id },
                        data: {
                            date: deathDate,
                            place: deathPlace
                        }
                    });
                } else {
                    await tx.familyEvent.create({
                        data: {
                            type: 'DEATH',
                            personId: personId,
                            date: deathDate,
                            place: deathPlace
                        }
                    });
                }
            } else {
                await tx.familyEvent.deleteMany({
                    where: {
                        type: 'DEATH',
                        personId: personId,
                    }
                })
            }
            
            if (data.removePhoto) {
                await tx.photo.deleteMany({
                    where: { personId }
                });
            }

            if (data.photoUrl) {
                if (data.photoUrl.startsWith('/api/photo/')) {
                    const existing = await tx.photo.findFirst({
                        where: { personId, url: data.photoUrl }
                    });

                    if (existing) {
                        if (data.replacePhoto !== false) {
                            await tx.photo.deleteMany({
                                where: { personId, NOT: { id: existing.id } }
                            });
                        }

                        if (data.photoDate) {
                            await tx.photo.update({
                                where: { id: existing.id },
                                data: { date: data.photoDate }
                            });
                        }
                    } else {
                        if (data.replacePhoto !== false) {
                            await tx.photo.deleteMany({
                                where: { personId }
                            });
                        }

                        await tx.photo.create({
                            data: {
                                url: data.photoUrl,
                                personId: personId,
                                date: data.photoDate
                            }
                        });
                    }
                } else {
                    if (data.replacePhoto !== false) {
                        await tx.photo.deleteMany({
                            where: { personId }
                        });
                    }

                    await tx.photo.create({
                        data: {
                            url: data.photoUrl,
                            personId: personId,
                            date: data.photoDate
                        }
                    });
                }
            }

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'PERSON_UPDATED',
                entityType: 'PERSON',
                entityId: personId,
                details: {
                    fields: Object.keys(data).filter((field) => field !== 'lastKnownUpdatedAt'),
                },
            })
        });

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: "Failed to update person" };
    }
}

export async function updateRelationship(
    personId: string,
    spouseId: string,
    data: {
        status: 'MARRIED' | 'DIVORCED';
        marriageDate?: Date;
        marriagePlace?: string;
        divorceDate?: Date;
        divorcePlace?: string;
    }
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    await ensurePersonEditableInGraph(userId, spouseId, graphContext.graphId)

    try {
        const family = await prisma.family.findFirst({
            where: {
                OR: [
                    { parent1Id: personId, parent2Id: spouseId },
                    { parent1Id: spouseId, parent2Id: personId }
                ]
            }
        });

        if (!family) return { error: "Marriage not found" };

        if (data.divorceDate && data.marriageDate && data.divorceDate < data.marriageDate) {
            return { error: "Divorce date cannot be earlier than marriage date" };
        }

        await prisma.$transaction(async (tx) => {
            const existingEvents = await tx.familyEvent.findMany({
                where: {
                    familyId: family.id,
                    type: { in: ['MARRIAGE', 'DIVORCE'] }
                }
            });

            const marriageEvent = existingEvents.find((event) => event.type === 'MARRIAGE');
            const divorceEvent = existingEvents.find((event) => event.type === 'DIVORCE');

            if (marriageEvent) {
                await tx.familyEvent.update({
                    where: { id: marriageEvent.id },
                    data: {
                        date: data.marriageDate,
                        place: data.marriagePlace || null
                    }
                });
            } else if (data.marriageDate || data.marriagePlace) {
                await tx.familyEvent.create({
                    data: {
                        type: 'MARRIAGE',
                        familyId: family.id,
                        date: data.marriageDate,
                        place: data.marriagePlace
                    }
                });
            }

            if (data.status === 'DIVORCED') {
                if (divorceEvent) {
                    await tx.familyEvent.update({
                        where: { id: divorceEvent.id },
                        data: {
                            date: data.divorceDate,
                            place: data.divorcePlace || null
                        }
                    });
                } else {
                    await tx.familyEvent.create({
                        data: {
                            type: 'DIVORCE',
                            familyId: family.id,
                            date: data.divorceDate,
                            place: data.divorcePlace
                        }
                    });
                }

                const distance = await computeRelationshipDistance(tx, userId, spouseId);
                await createRelationshipClaim(tx, {
                    fromPersonId: personId,
                    toPersonId: spouseId,
                    relationshipType: 'EX_SPOUSE',
                    contributorId: userId,
                    computedDistance: distance,
                });
                await createRelationshipClaim(tx, {
                    fromPersonId: spouseId,
                    toPersonId: personId,
                    relationshipType: 'EX_SPOUSE',
                    contributorId: userId,
                    computedDistance: distance,
                });
            } else if (divorceEvent) {
                await tx.familyEvent.delete({
                    where: { id: divorceEvent.id }
                });
            }

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'RELATIONSHIP_UPDATED',
                entityType: 'FAMILY',
                entityId: family.id,
                details: {
                    spouseId,
                    status: data.status,
                },
            })
        });

        revalidatePath('/dashboard');
        return { success: true };
    } catch {
        return { error: "Failed to update relationship" };
    }
}

export async function divorceSpouse(personId: string, spouseId: string, divorceDate?: Date) {
    return updateRelationship(personId, spouseId, {
        status: 'DIVORCED',
        divorceDate
    });
}

export async function linkExistingPersonAsSpouse(
    personId: string,
    spouseId: string,
    marriageDate?: Date
) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    await ensurePersonEditableInGraph(userId, spouseId, graphContext.graphId)

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [person, spouse, existingSpouseFamily, spouseIsDirectParent, spouseIsDirectChild] = await Promise.all([
                tx.person.findUnique({
                    where: { id: personId },
                    select: { id: true }
                }),
                tx.person.findUnique({
                    where: { id: spouseId },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        OR: [
                            { parent1Id: personId, parent2Id: spouseId },
                            { parent1Id: spouseId, parent2Id: personId }
                        ]
                    },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        children: { some: { id: personId } },
                        OR: [
                            { parent1Id: spouseId },
                            { parent2Id: spouseId }
                        ]
                    },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        children: { some: { id: spouseId } },
                        OR: [
                            { parent1Id: personId },
                            { parent2Id: personId }
                        ]
                    },
                    select: { id: true }
                })
            ])

            if (!person || !spouse) {
                throw new Error("Person not found");
            }

            const validation = validateExistingSpouseLink({
                personId,
                spouseId,
                alreadySpouses: Boolean(existingSpouseFamily),
                spouseIsDirectParent: Boolean(spouseIsDirectParent),
                spouseIsDirectChild: Boolean(spouseIsDirectChild),
            })

            if (!validation.valid) {
                throw new Error(validation.error)
            }

            const family = await tx.family.create({
                data: {
                    graphId: graphContext.graphId,
                    parent1Id: personId,
                    parent2Id: spouseId,
                    events: {
                        create: [
                            {
                                type: 'RELATIONSHIP_LINK',
                                date: new Date(),
                                description: buildExistingSpouseLinkAuditDescription({
                                    actorUserId: userId,
                                    personId,
                                    spouseId,
                                    familyId: ''
                                })
                            },
                            ...(marriageDate ? [{
                                type: 'MARRIAGE',
                                date: marriageDate
                            }] : [])
                        ]
                    }
                },
                select: {
                    id: true
                }
            })

            await tx.familyEvent.updateMany({
                where: {
                    familyId: family.id,
                    type: 'RELATIONSHIP_LINK'
                },
                data: {
                    description: buildExistingSpouseLinkAuditDescription({
                        actorUserId: userId,
                        personId,
                        spouseId,
                        familyId: family.id
                    })
                }
            })

            const distance = await computeRelationshipDistance(tx, userId, spouseId)

            await createRelationshipClaim(tx, {
                fromPersonId: personId,
                toPersonId: spouseId,
                relationshipType: 'SPOUSE',
                contributorId: userId,
                computedDistance: distance,
            })
            await createRelationshipClaim(tx, {
                fromPersonId: spouseId,
                toPersonId: personId,
                relationshipType: 'SPOUSE',
                contributorId: userId,
                computedDistance: distance,
            })

            await upsertUserPersonLink(tx, {
                userId,
                personId: spouseId,
                role: 'CONTRIBUTOR',
                status: 'ACTIVE',
                computedDistance: distance,
            })

            await tx.person.updateMany({
                where: {
                    id: { in: [personId, spouseId] },
                    graphId: null,
                },
                data: { graphId: graphContext.graphId },
            })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'EXISTING_SPOUSE_LINKED',
                entityType: 'FAMILY',
                entityId: family.id,
                details: {
                    personId,
                    spouseId,
                },
            })

            return { success: true, familyId: family.id }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to link existing person as spouse" };
    }
}

export async function linkExistingPersonAsParent(
    childId: string,
    parentId: string
) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, childId, 'edit')
    await ensurePersonEditableInGraph(userId, parentId, graphContext.graphId)

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [child, parent, parentIsDirectChild, parentIsDirectSpouse] = await Promise.all([
                tx.person.findUnique({
                    where: { id: childId },
                    select: {
                        id: true,
                        childOfFamilyId: true,
                        childOfFamily: {
                            select: {
                                id: true,
                                parent1Id: true,
                                parent2Id: true,
                            }
                        }
                    }
                }),
                tx.person.findUnique({
                    where: { id: parentId },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        children: { some: { id: parentId } },
                        OR: [
                            { parent1Id: childId },
                            { parent2Id: childId }
                        ]
                    },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        OR: [
                            { parent1Id: childId, parent2Id: parentId },
                            { parent1Id: parentId, parent2Id: childId }
                        ]
                    },
                    select: { id: true }
                })
            ])

            if (!child || !parent) {
                throw new Error("Person not found");
            }

            const alreadyParent = Boolean(
                child.childOfFamily &&
                [child.childOfFamily.parent1Id, child.childOfFamily.parent2Id].includes(parentId)
            )

            const validation = validateExistingParentLink({
                childId,
                parentId,
                alreadyParent,
                childHasOpenParentSlot: !child.childOfFamily || !child.childOfFamily.parent1Id || !child.childOfFamily.parent2Id,
                parentIsDirectChild: Boolean(parentIsDirectChild),
                parentIsDirectSpouse: Boolean(parentIsDirectSpouse),
            })

            if (!validation.valid) {
                throw new Error(validation.error)
            }

            let familyId: string

            if (!child.childOfFamily) {
                const family = await tx.family.create({
                    data: {
                        graphId: graphContext.graphId,
                        parent1Id: parentId,
                        children: { connect: { id: childId } }
                    },
                    select: { id: true }
                })
                familyId = family.id
            } else {
                familyId = child.childOfFamily.id
                await tx.family.update({
                    where: { id: child.childOfFamily.id },
                    data: child.childOfFamily.parent1Id
                        ? { parent2Id: parentId }
                        : { parent1Id: parentId }
                })
            }

            const distance = await computeRelationshipDistance(tx, userId, parentId)

            await createRelationshipClaim(tx, {
                fromPersonId: parentId,
                toPersonId: childId,
                relationshipType: 'BIO_PARENT',
                contributorId: userId,
                computedDistance: distance,
            })
            await createRelationshipClaim(tx, {
                fromPersonId: childId,
                toPersonId: parentId,
                relationshipType: 'CHILD',
                contributorId: userId,
                computedDistance: distance,
            })

            await upsertUserPersonLink(tx, {
                userId,
                personId: parentId,
                role: 'CONTRIBUTOR',
                status: 'ACTIVE',
                computedDistance: distance,
            })

            await tx.person.updateMany({
                where: {
                    id: { in: [childId, parentId] },
                    graphId: null,
                },
                data: { graphId: graphContext.graphId },
            })

            await tx.familyEvent.create({
                data: {
                    type: 'RELATIONSHIP_LINK_PARENT',
                    familyId,
                    date: new Date(),
                    description: buildExistingParentLinkAuditDescription({
                        actorUserId: userId,
                        childId,
                        parentId,
                        familyId,
                    })
                }
            })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'EXISTING_PARENT_LINKED',
                entityType: 'FAMILY',
                entityId: familyId,
                details: {
                    childId,
                    parentId,
                },
            })

            return { success: true, familyId }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to link existing person as parent" };
    }
}

export async function linkExistingPersonAsChild(
    parentId: string,
    childId: string
) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, parentId, 'edit')
    await ensurePersonEditableInGraph(userId, childId, graphContext.graphId)

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [parent, child, childIsDirectParent, childIsDirectSpouse] = await Promise.all([
                tx.person.findUnique({
                    where: { id: parentId },
                    select: {
                        id: true,
                        familiesAsParent1: {
                            select: { id: true }
                        },
                        familiesAsParent2: {
                            select: { id: true }
                        }
                    }
                }),
                tx.person.findUnique({
                    where: { id: childId },
                    select: {
                        id: true,
                        childOfFamilyId: true,
                        childOfFamily: {
                            select: {
                                id: true,
                                parent1Id: true,
                                parent2Id: true,
                            }
                        }
                    }
                }),
                tx.family.findFirst({
                    where: {
                        children: { some: { id: parentId } },
                        OR: [
                            { parent1Id: childId },
                            { parent2Id: childId }
                        ]
                    },
                    select: { id: true }
                }),
                tx.family.findFirst({
                    where: {
                        OR: [
                            { parent1Id: parentId, parent2Id: childId },
                            { parent1Id: childId, parent2Id: parentId }
                        ]
                    },
                    select: { id: true }
                })
            ])

            if (!parent || !child) {
                throw new Error("Person not found");
            }

            const parentFamilies = [...parent.familiesAsParent1, ...parent.familiesAsParent2]
            const firstParentFamilyId = parentFamilies[0]?.id
            const childParentIds = child.childOfFamily ? [child.childOfFamily.parent1Id, child.childOfFamily.parent2Id].filter(Boolean) : []
            const alreadyChild = childParentIds.includes(parentId) || child.childOfFamilyId === firstParentFamilyId

            const childHasConflictingFamily = Boolean(
                child.childOfFamily &&
                (
                    (firstParentFamilyId && child.childOfFamily.id !== firstParentFamilyId) ||
                    (!firstParentFamilyId && childParentIds.length === 2)
                ) &&
                !childParentIds.includes(parentId)
            )

            const validation = validateExistingChildLink({
                parentId,
                childId,
                alreadyChild,
                childHasConflictingFamily,
                childIsDirectParent: Boolean(childIsDirectParent),
                childIsDirectSpouse: Boolean(childIsDirectSpouse),
            })

            if (!validation.valid) {
                throw new Error(validation.error)
            }

            let familyId: string

            if (firstParentFamilyId) {
                familyId = firstParentFamilyId
                await tx.person.update({
                    where: { id: childId },
                    data: { childOfFamilyId: firstParentFamilyId }
                })
            } else if (child.childOfFamily) {
                familyId = child.childOfFamily.id
                await tx.family.update({
                    where: { id: child.childOfFamily.id },
                    data: child.childOfFamily.parent1Id
                        ? { parent2Id: parentId }
                        : { parent1Id: parentId }
                })
            } else {
                const family = await tx.family.create({
                    data: {
                        graphId: graphContext.graphId,
                        parent1Id: parentId,
                        children: { connect: { id: childId } }
                    },
                    select: { id: true }
                })
                familyId = family.id
            }

            const distance = await computeRelationshipDistance(tx, userId, childId)

            await createRelationshipClaim(tx, {
                fromPersonId: parentId,
                toPersonId: childId,
                relationshipType: 'BIO_PARENT',
                contributorId: userId,
                computedDistance: distance,
            })
            await createRelationshipClaim(tx, {
                fromPersonId: childId,
                toPersonId: parentId,
                relationshipType: 'CHILD',
                contributorId: userId,
                computedDistance: distance,
            })

            await upsertUserPersonLink(tx, {
                userId,
                personId: childId,
                role: 'CONTRIBUTOR',
                status: 'ACTIVE',
                computedDistance: distance,
            })

            await tx.person.updateMany({
                where: {
                    id: { in: [parentId, childId] },
                    graphId: null,
                },
                data: { graphId: graphContext.graphId },
            })

            await tx.familyEvent.create({
                data: {
                    type: 'RELATIONSHIP_LINK_CHILD',
                    familyId,
                    date: new Date(),
                    description: buildExistingChildLinkAuditDescription({
                        actorUserId: userId,
                        parentId,
                        childId,
                        familyId,
                    })
                }
            })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'EXISTING_CHILD_LINKED',
                entityType: 'FAMILY',
                entityId: familyId,
                details: {
                    parentId,
                    childId,
                },
            })

            return { success: true, familyId }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to link existing person as child" };
    }
}

export async function associateChildWithSpouse(
    personId: string,
    spouseId: string,
    spouseFamilyId: string,
    childId: string
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    await Promise.all([
      ensurePersonEditableInGraph(userId, spouseId, graphContext.graphId),
      ensurePersonEditableInGraph(userId, childId, graphContext.graphId),
    ])

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [spouseFamily, child] = await Promise.all([
                tx.family.findUnique({
                    where: { id: spouseFamilyId },
                    select: {
                        id: true,
                        parent1Id: true,
                        parent2Id: true
                    }
                }),
                tx.person.findUnique({
                    where: { id: childId },
                    select: {
                        id: true,
                        childOfFamilyId: true,
                        childOfFamily: {
                            select: {
                                id: true,
                                parent1Id: true,
                                parent2Id: true
                            }
                        }
                    }
                })
            ])

            if (!child) {
                throw new Error("Child not found");
            }

            const validation = validateChildSpouseAssociation({
                parentId: personId,
                spouseId,
                childId,
                spouseFamily,
                childFamily: child.childOfFamily
            })

            if (!validation.valid) {
                throw new Error(validation.error)
            }

            const previousFamilyId = child.childOfFamilyId

            await tx.person.update({
                where: { id: childId },
                data: {
                    childOfFamilyId: spouseFamilyId
                }
            })

            const childDistance = await computeRelationshipDistance(tx, userId, childId)

            await createRelationshipClaim(tx, {
                fromPersonId: spouseId,
                toPersonId: childId,
                relationshipType: 'BIO_PARENT',
                contributorId: userId,
                computedDistance: childDistance,
            })
            await createRelationshipClaim(tx, {
                fromPersonId: childId,
                toPersonId: spouseId,
                relationshipType: 'CHILD',
                contributorId: userId,
                computedDistance: childDistance,
            })

            await tx.familyEvent.create({
                data: {
                    type: 'CHILD_ASSOCIATION',
                    familyId: spouseFamilyId,
                    date: new Date(),
                    description: buildChildAssociationAuditDescription({
                        actorUserId: userId,
                        parentId: personId,
                        spouseId,
                        childId,
                        previousFamilyId,
                        nextFamilyId: spouseFamilyId,
                    })
                }
            })

            if (previousFamilyId && previousFamilyId !== spouseFamilyId) {
                const previousFamily = await tx.family.findUnique({
                    where: { id: previousFamilyId },
                    select: {
                        id: true,
                        parent1Id: true,
                        parent2Id: true,
                        children: {
                            select: { id: true }
                        },
                        events: {
                            select: { id: true }
                        }
                    }
                })

                if (
                    previousFamily &&
                    [previousFamily.parent1Id, previousFamily.parent2Id].includes(personId) &&
                    !previousFamily.parent2Id &&
                    previousFamily.children.length === 0 &&
                    previousFamily.events.length === 0
                ) {
                    await tx.family.delete({
                        where: { id: previousFamily.id }
                    })
                }
            }

            await tx.person.updateMany({
                where: {
                    id: { in: [personId, spouseId, childId] },
                    graphId: null,
                },
                data: { graphId: graphContext.graphId },
            })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'CHILD_ASSOCIATED_WITH_SPOUSE',
                entityType: 'FAMILY',
                entityId: spouseFamilyId,
                details: {
                    personId,
                    spouseId,
                    childId,
                },
            })

            return { success: true }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to associate child with spouse" };
    }
}

export async function reassignChildToSpouse(
    personId: string,
    spouseId: string,
    spouseFamilyId: string,
    childId: string
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    await Promise.all([
      ensurePersonEditableInGraph(userId, spouseId, graphContext.graphId),
      ensurePersonEditableInGraph(userId, childId, graphContext.graphId),
    ])

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [spouseFamily, child] = await Promise.all([
                tx.family.findUnique({
                    where: { id: spouseFamilyId },
                    select: {
                        id: true,
                        parent1Id: true,
                        parent2Id: true
                    }
                }),
                tx.person.findUnique({
                    where: { id: childId },
                    select: {
                        id: true,
                        childOfFamilyId: true,
                        childOfFamily: {
                            select: {
                                id: true,
                                parent1Id: true,
                                parent2Id: true
                            }
                        }
                    }
                })
            ])

            if (!child) {
                throw new Error("Child not found");
            }

            const validation = validateChildSpouseReassignment({
                parentId: personId,
                spouseId,
                childId,
                spouseFamily,
                childFamily: child.childOfFamily
            })

            if (!validation.valid) {
                throw new Error(validation.error)
            }

            const previousFamilyId = child.childOfFamilyId

            await tx.person.update({
                where: { id: childId },
                data: {
                    childOfFamilyId: spouseFamilyId
                }
            })

            const childDistance = await computeRelationshipDistance(tx, userId, childId)

            await createRelationshipClaim(tx, {
                fromPersonId: spouseId,
                toPersonId: childId,
                relationshipType: 'BIO_PARENT',
                contributorId: userId,
                computedDistance: childDistance,
            })
            await createRelationshipClaim(tx, {
                fromPersonId: childId,
                toPersonId: spouseId,
                relationshipType: 'CHILD',
                contributorId: userId,
                computedDistance: childDistance,
            })

            await tx.familyEvent.create({
                data: {
                    type: 'CHILD_ASSOCIATION_CHANGED',
                    familyId: spouseFamilyId,
                    date: new Date(),
                    description: buildChildAssociationAuditDescription({
                        actorUserId: userId,
                        parentId: personId,
                        spouseId,
                        childId,
                        previousFamilyId,
                        nextFamilyId: spouseFamilyId,
                    })
                }
            })

            if (previousFamilyId && previousFamilyId !== spouseFamilyId) {
                const previousFamily = await tx.family.findUnique({
                    where: { id: previousFamilyId },
                    select: {
                        id: true,
                        parent1Id: true,
                        parent2Id: true,
                        children: {
                            select: { id: true }
                        },
                        events: {
                            select: { id: true }
                        }
                    }
                })

                if (
                    previousFamily &&
                    [previousFamily.parent1Id, previousFamily.parent2Id].includes(personId) &&
                    !previousFamily.parent2Id &&
                    previousFamily.children.length === 0 &&
                    previousFamily.events.length === 0
                ) {
                    await tx.family.delete({
                        where: { id: previousFamily.id }
                    })
                }
            }

            await tx.person.updateMany({
                where: {
                    id: { in: [personId, spouseId, childId] },
                    graphId: null,
                },
                data: { graphId: graphContext.graphId },
            })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'CHILD_ASSOCIATION_CHANGED',
                entityType: 'FAMILY',
                entityId: spouseFamilyId,
                details: {
                    personId,
                    spouseId,
                    childId,
                    previousFamilyId,
                },
            })

            return { success: true }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to change child association" };
    }
}

export async function deletePerson(personId: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const userId = session.user.id;

    const graphContext = await requireGraphPermissionForPerson(prisma, userId, personId, 'edit')
    const role = typeof graphContext.role === 'string' ? graphContext.role.trim().toUpperCase() : ''
    if (role !== 'OWNER' && role !== 'ADMIN') {
        return { error: 'Only the graph owner can delete people.' }
    }

    const [graphRoot, userRoot, scopeCount, person] = await Promise.all([
        prisma.familyGraph.findFirst({ where: { rootPersonId: personId }, select: { id: true } }),
        prisma.user.findFirst({ where: { rootPersonId: personId }, select: { id: true } }),
        prisma.graphMembershipScope.count({ where: { anchorPersonId: personId } }),
        prisma.person.findUnique({
            where: { id: personId },
            select: { id: true, linkedUserId: true }
        })
    ])

    if (!person) return { error: 'Person not found' }
    if (graphRoot) return { error: 'Cannot delete the root person of a graph.' }
    if (userRoot || person.linkedUserId) return { error: 'Cannot delete a person linked to a user account.' }
    if (scopeCount > 0) return { error: 'Cannot delete a person that is used as a permission anchor.' }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const affectedFamilies = await tx.family.findMany({
                where: {
                    OR: [{ parent1Id: personId }, { parent2Id: personId }]
                },
                select: { id: true }
            })

            await tx.graphInvitation.updateMany({
                where: { targetPersonId: personId },
                data: { targetPersonId: null },
            })

            await tx.family.updateMany({
                where: { parent1Id: personId },
                data: { parent1Id: null },
            })
            await tx.family.updateMany({
                where: { parent2Id: personId },
                data: { parent2Id: null },
            })

            if (affectedFamilies.length > 0) {
                const families = await tx.family.findMany({
                    where: { id: { in: affectedFamilies.map((family) => family.id) } },
                    select: {
                        id: true,
                        parent1Id: true,
                        parent2Id: true,
                        children: { select: { id: true }, take: 1 },
                        events: { select: { id: true }, take: 1 },
                    }
                })

                const deletable = families
                    .filter((family) => !family.parent1Id && !family.parent2Id && family.children.length === 0 && family.events.length === 0)
                    .map((family) => family.id)

                if (deletable.length > 0) {
                    await tx.family.deleteMany({ where: { id: { in: deletable } } })
                }
            }

            await tx.person.delete({ where: { id: personId } })

            await createGraphAuditEntry(tx, {
                graphId: graphContext.graphId,
                actorUserId: userId,
                action: 'PERSON_DELETED',
                entityType: 'PERSON',
                entityId: personId,
                details: {
                    personId,
                },
            })

            return { success: true }
        })

        revalidatePath('/dashboard');
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message) {
            return { error: error.message };
        }
        return { error: "Failed to delete person" };
    }
}
