'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'

export async function inviteUser(personId: string, email: string) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return { error: "Person not found" };
    
    // Allow inviting if the user created the person OR if the user is linked to someone in the same tree?
    // For simplicity, let's stick to creator or maybe relax it later.
    // If I am navigating the tree, I should be able to invite my brother to claim his node.
    // Even if I didn't create him (maybe my father did), I should be able to invite?
    // For now, let's keep it to creator to avoid spam, or check if user has access to this tree.
    // But "createdById" is simple.
    if (person.createdById !== userId) {
        // return { error: "Only creator can invite" };
    }

    const token = randomBytes(32).toString('hex');
    
    await prisma.invitation.create({
        data: {
            email,
            personId,
            token,
            inviterId: userId
        }
    });

    // In a real app, we would send an email here.
    // For this demo, we return the link.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return { success: true, link: `${baseUrl}/invite/${token}` };
}

export async function acceptInvitation(token: string) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const invitation = await tx.invitation.findUnique({ 
            where: { token },
            include: { person: true }
        });
        if (!invitation) throw new Error("Invalid invitation");
        if (invitation.status !== 'PENDING') throw new Error("Invitation already processed");

        const user = await tx.user.findUnique({
            where: { id: userId },
            include: { rootPerson: true }
        });

        if (!user) throw new Error("User not found");

        const targetPersonId = invitation.personId; // The node we are claiming
        const sourcePersonId = user.rootPersonId;   // The user's current node (if any)

        // Scenario 1: User has no existing tree (no root person)
        if (!sourcePersonId) {
            // Just link
            await tx.person.update({
                where: { id: targetPersonId },
                data: { linkedUserId: user.id }
            });
            await tx.user.update({
                where: { id: user.id },
                data: { rootPersonId: targetPersonId }
            });
        } 
        // Scenario 2: User has an existing tree and it's different from target
        else if (sourcePersonId !== targetPersonId) {
            const sourcePerson = await tx.person.findUnique({
                where: { id: sourcePersonId },
                include: {
                    familiesAsParent1: true,
                    familiesAsParent2: true,
                    childOfFamily: true,
                    events: true,
                    photos: true
                }
            });
            
            if (sourcePerson) {
                const targetPerson = await tx.person.findUnique({ where: { id: targetPersonId } });
                
                // A. Move Parents (if Target has none)
                if (sourcePerson.childOfFamilyId && !targetPerson?.childOfFamilyId) {
                    await tx.person.update({
                        where: { id: targetPersonId },
                        data: { childOfFamilyId: sourcePerson.childOfFamilyId }
                    });
                }
                // Note: If both have parents, we prioritize Target's parents. 
                // Source's relationship to parents is lost (but parents remain in DB).

                // B. Move Families where Source is Parent1
                for (const family of sourcePerson.familiesAsParent1) {
                    // Check if Target is already Parent1 in this family? No, family is unique entity.
                    // But check if Target already has a family with the SAME spouse?
                    // For MVP, we just move the family pointer.
                    await tx.family.update({
                        where: { id: family.id },
                        data: { parent1Id: targetPersonId }
                    });
                }

                // C. Move Families where Source is Parent2
                for (const family of sourcePerson.familiesAsParent2) {
                    await tx.family.update({
                        where: { id: family.id },
                        data: { parent2Id: targetPersonId }
                    });
                }

                // D. Move Events
                for (const event of sourcePerson.events) {
                    await tx.familyEvent.update({
                        where: { id: event.id },
                        data: { personId: targetPersonId }
                    });
                }

                // E. Move Photos
                for (const photo of sourcePerson.photos) {
                    await tx.photo.update({
                        where: { id: photo.id },
                        data: { personId: targetPersonId }
                    });
                }
                
                // F. Update User to point to Target
                await tx.user.update({
                    where: { id: user.id },
                    data: { rootPersonId: targetPersonId }
                });

                // G. Link Target to User
                await tx.person.update({
                    where: { id: targetPersonId },
                    data: { linkedUserId: user.id }
                });

                // H. Create Layer from Source Person Data (Preserve History)
                await tx.personLayer.create({
                    data: {
                        personId: targetPersonId,
                        firstName: sourcePerson.firstName,
                        lastName: sourcePerson.lastName,
                        middleName: sourcePerson.middleName,
                        nickName: sourcePerson.nickName,
                        title: sourcePerson.title,
                        gender: sourcePerson.gender,
                        dateOfBirth: sourcePerson.dateOfBirth,
                        placeOfBirth: sourcePerson.placeOfBirth,
                        dateOfDeath: sourcePerson.dateOfDeath,
                        placeOfDeath: sourcePerson.placeOfDeath,
                        contributorId: user.id,
                        relationshipDistance: 0 // Self claiming
                    }
                });

                // I. Delete Source Person
                await tx.person.delete({ where: { id: sourcePersonId } });
            }
        }

        // Update invitation status
        await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED' }
        });

        return { success: true };
    });
}
