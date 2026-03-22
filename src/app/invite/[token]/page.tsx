import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { acceptInvitation } from '@/actions/invitation';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <h1 className="text-2xl font-bold">Invitation to Connect</h1>
      <p className="text-center">You have been invited to claim a profile in a family tree.</p>
      
      <form action={async () => {
        'use server';
        await acceptInvitation(token);
        redirect('/dashboard');
      }}>
        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition">Accept Invitation</button>
      </form>
    </div>
  );
}
