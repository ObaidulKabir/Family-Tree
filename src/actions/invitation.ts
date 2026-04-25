'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { createPersonClaims, upsertUserPersonLink } from '@/lib/graph'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { requireGraphPermissionForPerson } from '@/actions/graphManagement'

export async function inviteUser(personId: string, email: string) {
    const session = await auth();
    if (!session?.user) return { error: "Unauthorized" };
    if (!session.user.id) return { error: "Unauthorized" };
    const userId = session.user.id;
    await requireGraphPermissionForPerson(prisma, userId, personId, 'manage')

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return { error: "Person not found" };

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

        await upsertUserPersonLink(tx, {
            userId,
            personId: targetPersonId,
            role: 'SELF',
            status: 'ACTIVE',
            assertedDistance: 0,
            computedDistance: 0,
            invitedByUserId: invitation.inviterId,
            invitationId: invitation.id,
        });

        await createPersonClaims(tx, {
            personId: targetPersonId,
            contributorId: user.id,
            sourceType: 'INVITATION_CONFIRMATION',
            sourceRefId: invitation.id,
            assertedDistance: 0,
            computedDistance: 0,
            values: {
                firstName: invitation.person.firstName,
                lastName: invitation.person.lastName ?? null,
                middleName: invitation.person.middleName ?? null,
                nickName: invitation.person.nickName ?? null,
                title: invitation.person.title ?? null,
                gender: invitation.person.gender ?? null,
                dateOfBirth: invitation.person.dateOfBirth ?? null,
                placeOfBirth: invitation.person.placeOfBirth ?? null,
                dateOfDeath: invitation.person.dateOfDeath ?? null,
                placeOfDeath: invitation.person.placeOfDeath ?? null,
            },
        });

        if (!invitation.person.linkedUserId || invitation.person.linkedUserId === user.id) {
            await tx.person.update({
                where: { id: targetPersonId },
                data: { linkedUserId: user.id }
            });
        }

        if (sourcePersonId && sourcePersonId !== targetPersonId) {
            const [leftPersonId, rightPersonId] = [sourcePersonId, targetPersonId].sort()

            await tx.personLink.upsert({
                where: {
                    leftPersonId_rightPersonId: {
                        leftPersonId,
                        rightPersonId,
                    },
                },
                update: {
                    linkType: 'VERIFIED_SAME',
                    sourceType: 'INVITATION',
                    confidenceScore: 1,
                    resolutionStatus: 'ACCEPTED',
                    createdByUserId: invitation.inviterId,
                },
                create: {
                    leftPersonId,
                    rightPersonId,
                    linkType: 'VERIFIED_SAME',
                    sourceType: 'INVITATION',
                    confidenceScore: 1,
                    resolutionStatus: 'ACCEPTED',
                    createdByUserId: invitation.inviterId,
                },
            })

            await tx.userPersonLink.updateMany({
                where: {
                    userId,
                    personId: sourcePersonId,
                },
                data: {
                    status: 'LINKED',
                },
            })
        }

        await tx.user.update({
            where: { id: user.id },
            data: { rootPersonId: targetPersonId }
        });

        // Update invitation status
        await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED' }
        });

        return { success: true };
    });
}
