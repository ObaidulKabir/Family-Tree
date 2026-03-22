'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function getPersonDetails(personId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
        events: true, 
        photos: true,
        childOfFamily: {
            include: {
                parent1: true,
                parent2: true
            }
        },
        familiesAsParent1: {
            include: {
                parent1: true,
                parent2: true,
                children: true,
                events: true
            }
        },
        familiesAsParent2: {
            include: {
                parent1: true,
                parent2: true,
                children: true,
                events: true
            }
        }
    }
  })

  if (!person) return { error: "Person not found" }

  // Parents
  const parents: unknown[] = [];
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
          marriageId: marriageEvent?.id,
          isDivorced: !!divorceEvent,
          divorceDate: divorceEvent?.date
      };
  }).filter(Boolean);

  // Children
  const children = allFamilies.flatMap(f => f.children);

  // Siblings
  let siblings: unknown[] = [];
  if (person.childOfFamilyId) {
      const family = await prisma.family.findUnique({
          where: { id: person.childOfFamilyId },
          include: { children: true }
      });
      if (family) {
          siblings = family.children.filter((c: { id: string }) => c.id !== person.id);
      }
  }

  return {
      person,
      parents,
      spouses,
      children,
      siblings
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
        const newPerson = await prisma.person.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.gender,
                dateOfBirth: data.dateOfBirth,
                placeOfBirth: data.placeOfBirth,
                createdById: userId
            }
        });

        // Create Initial Layer
        await prisma.personLayer.create({
            data: {
                personId: newPerson.id,
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.gender,
                dateOfBirth: data.dateOfBirth,
                placeOfBirth: data.placeOfBirth,
                contributorId: userId,
                relationshipDistance: 0,
                confidenceScore: 1.0
            }
        });

        if (relationType === 'PARENT') {
            // relationToId is the CHILD. We are adding a PARENT.
            const child = await prisma.person.findUnique({
                where: { id: relationToId },
                include: { childOfFamily: true }
            });

            if (child) {
                if (child.childOfFamily) {
                    const family = child.childOfFamily;
                    if (!family.parent1Id) {
                        await prisma.family.update({
                            where: { id: family.id },
                            data: { parent1Id: newPerson.id }
                        });
                    } else if (!family.parent2Id) {
                        await prisma.family.update({
                            where: { id: family.id },
                            data: { parent2Id: newPerson.id }
                        });
                    } else {
                         return { error: "Both parents already defined" };
                    }
                } else {
                    // Create new family
                    await prisma.family.create({
                        data: {
                            parent1Id: newPerson.id,
                            children: { connect: { id: child.id } }
                        }
                    });
                }
            }
        } else if (relationType === 'CHILD') {
            // relationToId is the PARENT. We are adding a CHILD.
            const parent = await prisma.person.findUnique({
                where: { id: relationToId },
                include: { familiesAsParent1: true, familiesAsParent2: true }
            });
            
            if (parent) {
                const families = [...parent.familiesAsParent1, ...parent.familiesAsParent2];
                
                if (families.length > 0) {
                    // Add to the first found family (simplification)
                    await prisma.family.update({
                        where: { id: families[0].id },
                        data: { children: { connect: { id: newPerson.id } } }
                    });
                } else {
                    // Create new family
                    await prisma.family.create({
                        data: {
                            parent1Id: parent.id,
                            children: { connect: { id: newPerson.id } }
                        }
                    });
                }
            }
        } else if (relationType === 'SPOUSE') {
            // Create a new Family with both
            await prisma.family.create({
                data: {
                    parent1Id: relationToId,
                    parent2Id: newPerson.id,
                    events: data.marriageDate ? {
                        create: {
                            type: 'MARRIAGE',
                            date: data.marriageDate
                        }
                    } : undefined
                }
            });
        }
        
        revalidatePath('/dashboard');
        return { success: true, person: newPerson };

    } catch (error) {
        console.error(error);
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
    }
) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return { error: "Person not found" };
    
    try {
        // Create History Layer
        const distance = (person.createdById === userId || person.linkedUserId === userId) ? 0 : 5;
        
        await prisma.personLayer.create({
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
                relationshipDistance: distance
            }
        });

        await prisma.person.update({
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
        
        // Handle Death Event
        if (data.dateOfDeath) {
            const deathEvent = await prisma.familyEvent.findFirst({
                where: {
                    type: 'DEATH',
                    personId: personId
                }
            });

            if (deathEvent) {
                await prisma.familyEvent.update({
                    where: { id: deathEvent.id },
                    data: {
                        date: data.dateOfDeath,
                        place: data.placeOfDeath
                    }
                });
            } else {
                await prisma.familyEvent.create({
                    data: {
                        type: 'DEATH',
                        personId: personId,
                        date: data.dateOfDeath,
                        place: data.placeOfDeath
                    }
                });
            }
        }
        
        if (data.photoUrl) {
            await prisma.photo.create({
                data: {
                    url: data.photoUrl,
                    personId: personId,
                    date: data.photoDate
                }
            });
        }
        
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { error: "Failed to update person" };
    }
}

export async function divorceSpouse(personId: string, spouseId: string, divorceDate?: Date) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };

    try {
        // Find the family
        const family = await prisma.family.findFirst({
            where: {
                OR: [
                    { parent1Id: personId, parent2Id: spouseId },
                    { parent1Id: spouseId, parent2Id: personId }
                ]
            }
        });

        if (!family) return { error: "Marriage not found" };

        await prisma.familyEvent.create({
            data: {
                type: 'DIVORCE',
                familyId: family.id,
                date: divorceDate
            }
        });

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        return { error: "Failed to record divorce" };
    }
}
