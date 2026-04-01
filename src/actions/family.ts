'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { computeRelationshipDistance, createPersonClaims, createRelationshipClaim, upsertUserPersonLink } from '@/lib/graph'
import { buildPersonReviewState, groupClaimsByPerson, resolvePersonFromClaims, summarizeReviewQueue } from '@/lib/resolution'
import { revalidatePath } from 'next/cache'

export async function getPersonDetails(personId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

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
      reviewSummary
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

    try {
        const newPerson = await prisma.$transaction(async (tx) => {
            const createdPerson = await tx.person.create({
                data: {
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

export async function updatePerson(
    personId: string,
    data: { 
        firstName: string; 
        lastName?: string; 
        middleName?: string;
        nickName?: string;
        gender?: string; 
        dateOfBirth?: Date; 
        placeOfBirth?: string;
        dateOfDeath?: Date;
        placeOfDeath?: string;
        title?: string;
        photoUrl?: string;
        photoDate?: Date;
        replacePhoto?: boolean;
        removePhoto?: boolean;
    }
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return { error: "Person not found" };
    
    try {
        const distance = await computeRelationshipDistance(prisma, userId, personId);

        await prisma.$transaction(async (tx) => {
            await tx.personLayer.create({
                data: {
                    personId: personId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    middleName: data.middleName,
                    nickName: data.nickName,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    dateOfDeath: data.dateOfDeath,
                    placeOfDeath: data.placeOfDeath,
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
                    dateOfBirth: data.dateOfBirth ?? null,
                    placeOfBirth: data.placeOfBirth ?? null,
                    dateOfDeath: data.dateOfDeath ?? null,
                    placeOfDeath: data.placeOfDeath ?? null,
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
                    dateOfBirth: data.dateOfBirth,
                    placeOfBirth: data.placeOfBirth,
                    dateOfDeath: data.dateOfDeath,
                    placeOfDeath: data.placeOfDeath,
                    title: data.title
                }
            });
            
            if (data.dateOfDeath) {
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
                            date: data.dateOfDeath,
                            place: data.placeOfDeath
                        }
                    });
                } else {
                    await tx.familyEvent.create({
                        data: {
                            type: 'DEATH',
                            personId: personId,
                            date: data.dateOfDeath,
                            place: data.placeOfDeath
                        }
                    });
                }
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
