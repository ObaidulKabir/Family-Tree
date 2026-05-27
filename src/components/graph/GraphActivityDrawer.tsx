'use client'

import { format } from 'date-fns'
import { X } from 'lucide-react'

export type GraphActivityItem = {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId?: string | null
  targets?: Array<{ personId: string; label: string }>
  actor?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
}

function formatActorName(actor: GraphActivityItem['actor']) {
  if (!actor) return 'System'
  return actor.name ?? actor.email ?? 'Unknown'
}

function formatActionLabel(action: string) {
  return action.replaceAll('_', ' ').toLowerCase()
}

export default function GraphActivityDrawer(props: {
  open: boolean
  onClose: () => void
  graphName?: string | null
  items: GraphActivityItem[]
  onOpenPerson?: (personId: string) => void
}) {
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-900/30"
        onClick={props.onClose}
        aria-label="Close activity"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">
              {props.graphName ? props.graphName : 'Family graph'}
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={props.onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-[calc(100%-64px)] overflow-auto px-5 py-4">
          {props.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No recent activity yet.
            </div>
          ) : (
            <div className="space-y-3">
              {props.items.map((item) => {
                const createdAt = new Date(item.createdAt)
                const timeLabel = Number.isNaN(createdAt.getTime()) ? '' : format(createdAt, 'PP p')
                const targets = (item.targets ?? []).filter((target) => typeof target.personId === 'string' && target.personId)
                const canOpenAny = Boolean(props.onOpenPerson && targets.length > 0)
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatActionLabel(item.action)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {formatActorName(item.actor)} • {item.entityType}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {timeLabel ? (
                          <div className="whitespace-nowrap text-xs text-slate-500">{timeLabel}</div>
                        ) : null}
                        {canOpenAny ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {targets.slice(0, 3).map((target) => (
                              <button
                                key={target.personId}
                                type="button"
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => props.onOpenPerson?.(target.personId)}
                              >
                                Open {target.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

