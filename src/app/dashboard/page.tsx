import { auth } from '@/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import FamilyTreeView from '@/components/family/FamilyTreeView';
import { prisma } from '@/lib/prisma';
import { createPersonClaims, splitDisplayName, upsertUserPersonLink } from '@/lib/graph';
import { canManageGraph } from '@/lib/graphManagement';
import { getAvailableGraphsForSession, getCurrentGraphContext } from '@/actions/graphManagement';
import { SignOut } from '@/components/auth/SignOut';
import GraphSwitcher from '@/components/graph/GraphSwitcher';

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
    redirect('/login');
  }

  const displayName = user.name ?? session.user.name ?? 'User'

  let rootPersonId = user.rootPersonId
  if (!rootPersonId) {
    const { firstName, lastName } = splitDisplayName(displayName)

    rootPersonId = await prisma.$transaction(async (tx) => {
      const rootPerson = await tx.person.create({
        data: {
          firstName,
          lastName: lastName || '',
          createdById: user.id,
          linkedUserId: user.id,
        },
      })

      await tx.user.update({
        where: { id: user.id },
        data: { rootPersonId: rootPerson.id },
      })

      await tx.personLayer.create({
        data: {
          personId: rootPerson.id,
          firstName,
          lastName: lastName || '',
          contributorId: user.id,
          relationshipDistance: 0,
          confidenceScore: 1,
        },
      })

      await upsertUserPersonLink(tx, {
        userId: user.id,
        personId: rootPerson.id,
        role: 'SELF',
        status: 'ACTIVE',
        assertedDistance: 0,
        computedDistance: 0,
      })

      await createPersonClaims(tx, {
        personId: rootPerson.id,
        contributorId: user.id,
        sourceType: 'SYSTEM_RECOVERY',
        assertedDistance: 0,
        computedDistance: 0,
        values: {
          firstName,
          lastName: lastName || '',
        },
      })

      return rootPerson.id
    })
  }

  const graphContext = await getCurrentGraphContext(user.id, displayName, rootPersonId)
  const availableGraphsResult = await getAvailableGraphsForSession()
  const initialPersonId = graphContext.rootPersonId ?? rootPersonId
  const canManageCurrentGraph = canManageGraph(graphContext.role)
  const availableGraphs = !availableGraphsResult.error ? (availableGraphsResult.graphs ?? []) : []
  const currentGraphId = !availableGraphsResult.error ? availableGraphsResult.currentGraphId : graphContext.graphId

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-serif font-bold text-lg">F</div>
                <h1 className="text-xl font-serif font-bold text-gray-800">FamilyExplorer</h1>
            </div>
            
            <div className="flex flex-wrap items-center justify-start gap-4 sm:justify-end">
               <GraphSwitcher currentGraphId={currentGraphId} graphs={availableGraphs} />
               <Link href="/dashboard/review" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                 Review updates
               </Link>
               <Link href="/dashboard/settings" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                 Settings
               </Link>
               {canManageCurrentGraph ? (
                 <Link href="/dashboard/graph-management" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                   Graph management
                 </Link>
               ) : null}
               {graphContext.graphName ? (
                 <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 md:inline-flex">
                   {graphContext.graphName}
                 </span>
               ) : null}
               <span className="text-sm text-gray-500 font-medium hidden md:block">Welcome, {displayName}</span>
               <SignOut />
            </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
         <FamilyTreeView key={graphContext.graphId ?? initialPersonId} initialPersonId={initialPersonId} />
      </main>
    </div>
  );
}
