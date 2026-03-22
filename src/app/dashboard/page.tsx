import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import FamilyTreeView from '@/components/family/FamilyTreeView';
import { prisma } from '@/lib/prisma';
import { SignOut } from '@/components/auth/SignOut';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch the root person ID for the user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rootPersonId: true }
  });

  if (!user?.rootPersonId) {
    // This might happen if registration failed halfway or manual DB edit.
    // Ideally we should create one or prompt user.
    return <div>Error: No root person found for user.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-serif font-bold text-lg">F</div>
                <h1 className="text-xl font-serif font-bold text-gray-800">FamilyHeritage</h1>
            </div>
            
            <div className="flex items-center gap-6">
               <span className="text-sm text-gray-500 font-medium hidden md:block">Welcome, {session.user.name}</span>
               <SignOut />
            </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
         <FamilyTreeView initialPersonId={user.rootPersonId} />
      </main>
    </div>
  );
}
