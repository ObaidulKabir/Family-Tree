import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { getAvailableGraphsForSession, getCurrentGraphContext, getGraphManagementPanelData } from '@/actions/graphManagement'
import GraphSwitcher from '@/components/graph/GraphSwitcher'
import GraphManagementPanel, { type GraphManagementPanelData } from '@/components/graph/GraphManagementPanel'
import { prisma } from '@/lib/prisma'

export default async function GraphManagementPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/graph-management')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, rootPersonId: true },
  })

  if (!user?.id || !user.rootPersonId) {
    redirect('/dashboard')
  }

  const graphContext = await getCurrentGraphContext(
    user.id,
    user.name ?? session.user.name ?? 'User',
    user.rootPersonId
  )
  const availableGraphsResult = await getAvailableGraphsForSession()
  const currentGraphId = !availableGraphsResult.error ? availableGraphsResult.currentGraphId : graphContext.graphId
  const availableGraphs = !availableGraphsResult.error ? (availableGraphsResult.graphs ?? []) : []
  const activeGraph = availableGraphs.find((graph) => graph.id === currentGraphId)

  const result = await getGraphManagementPanelData()
  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
            <div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 w-fit">
                Graph workspace
              </div>
              <h1 className="mt-4 text-3xl font-serif font-bold text-slate-900">Graph management</h1>
              <p className="mt-2 text-sm text-slate-600">
                Manage invitations and contributors for the selected graph when you have an admin role.
              </p>
              {activeGraph ? (
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {activeGraph.name} • {activeGraph.role.toLowerCase()}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-stretch gap-3 md:items-end">
              <GraphSwitcher currentGraphId={currentGraphId} graphs={availableGraphs} />
            </div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-red-700">
            {result.error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <GraphManagementPanel
      initialData={result as GraphManagementPanelData}
      currentGraphId={currentGraphId}
      availableGraphs={availableGraphs}
    />
  )
}

