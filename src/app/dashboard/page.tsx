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
    select: { id: true, name: true, rootPersonId: true }
  });

  if (!user) {
    return <div>Error: User not found.</div>;
  }

  const displayName = user.name ?? session.user.name ?? 'User'

  let rootPersonId = user.rootPersonId
  if (!rootPersonId) {
    const parts = displayName.trim().split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? 'User'
    const lastName = parts.slice(1).join(' ')

    const rootPerson = await prisma.person.create({
      data: {
        firstName,
        lastName: lastName || '',
        createdById: user.id,
        linkedUserId: user.id,
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { rootPersonId: rootPerson.id },
    })

    rootPersonId = rootPerson.id
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
               <span className="text-sm text-gray-500 font-medium hidden md:block">Welcome, {displayName}</span>
               <SignOut />
            </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
         <FamilyTreeView initialPersonId={rootPersonId} />
      </main>
    </div>
  );
}
