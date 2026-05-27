'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { switchCurrentGraph } from '@/actions/graphManagement'

export default function GraphSwitcher(props: {
  currentGraphId?: string | null
  graphs: Array<{ id: string; name: string; role: string }>
}) {
  const router = useRouter()
  const [value, setValue] = useState(props.currentGraphId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (props.graphs.length <= 1) return null

  return (
    <div className="flex min-w-[220px] flex-col gap-1">
      <label htmlFor="graph-switcher" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Active graph
      </label>
      <select
        id="graph-switcher"
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const nextGraphId = event.target.value
          setValue(nextGraphId)
          setError(null)

          startTransition(async () => {
            const result = await switchCurrentGraph(nextGraphId)
            if (result?.error) {
              setError(result.error)
              setValue(props.currentGraphId ?? '')
              return
            }

            router.refresh()
          })
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
      >
        {props.graphs.map((graph) => (
          <option key={graph.id} value={graph.id}>
            {graph.name} ({graph.role.toLowerCase()})
          </option>
        ))}
      </select>
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
    </div>
  )
}

