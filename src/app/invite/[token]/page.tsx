import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { acceptInvitation } from '@/actions/invitation';
import { prisma } from '@/lib/prisma';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      person: true,
      inviter: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Invitation not found</h1>
          <p className="mt-2 text-sm text-gray-600">This invite link is invalid or may have expired.</p>
        </div>
      </div>
    )
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rootPersonId: true },
  })

  const needsConnectionReview = Boolean(currentUser?.rootPersonId && currentUser.rootPersonId !== invitation.personId)
  const inviterName = invitation.inviter.name ?? invitation.inviter.email ?? 'A family member'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Claim your family profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          {inviterName} invited you to manage this profile in the family tree.
        </p>

        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Profile preview</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">
            {invitation.person.firstName} {invitation.person.lastName}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {invitation.person.title || 'Family member profile'}
          </div>
        </div>

        {needsConnectionReview ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This may connect your current profile to an existing family record. You can still continue and review links from the dashboard after claiming.
          </div>
        ) : null}
        
        <form
          className="mt-6"
          action={async () => {
            'use server';
            await acceptInvitation(token);
            redirect('/dashboard');
          }}
        >
          <button type="submit" className="w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 transition">
            Claim this profile
          </button>
        </form>
      </div>
    </div>
  );
}
