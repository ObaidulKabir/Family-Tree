import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import GraphManagementPanel, { type GraphManagementPanelData } from '@/components/graph/GraphManagementPanel'
import { getGraphManagementPanelData } from '@/actions/graphManagement'

export default async function GraphManagementPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/graph-management')
  }

  const result = await getGraphManagementPanelData()
  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-red-700">
          {result.error}
        </div>
      </div>
    )
  }

  return <GraphManagementPanel initialData={result as GraphManagementPanelData} />
}

