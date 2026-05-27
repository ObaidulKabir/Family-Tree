'use client'

import Link from 'next/link'

import { Activity, ClipboardList, Shield, Users } from 'lucide-react'

export type GraphPresenceMember = {
  id: string
  name?: string | null
  email?: string | null
  role: string
  presence: 'online' | 'away' | 'offline'
}

export type GraphCollaborationBarData = {
  graph: { id: string; name: string }
  me: { role: string; canManage: boolean; canInvite: boolean; allowedInviteRoles: string[] }
  members: GraphPresenceMember[]
  pendingInvites: number
  reviewCount?: number
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).filter(Boolean).join('')
}

function presenceClass(presence: GraphPresenceMember['presence']) {
  if (presence === 'online') return 'bg-emerald-100 text-emerald-800'
  if (presence === 'away') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function roleLabel(role: string) {
  return role.toLowerCase()
}

export default function GraphCollaborationBar(props: {
  data: GraphCollaborationBarData
  onOpenActivity: () => void
  onOpenInvite?: () => void
}) {
  const visibleMembers = props.data.members.slice(0, 6)
  const extraCount = Math.max(props.data.members.length - visibleMembers.length, 0)

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active graph
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-slate-900 truncate">{props.data.graph.name}</div>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
              <Shield size={12} />
              {roleLabel(props.data.me.role)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users size={14} />
              {props.data.members.length} collaborators
            </span>
            <span>• Workspace permissions follow this selected graph</span>
            {props.data.me.canInvite ? (
              <span>• {props.data.pendingInvites} pending invites</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/review"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList size={16} />
            Review
            {props.data.reviewCount ? (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {props.data.reviewCount}
              </span>
            ) : null}
          </Link>
          <button
            onClick={props.onOpenActivity}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="button"
          >
            <Activity size={16} />
            Activity
          </button>
          {props.data.me.canInvite ? (
            props.onOpenInvite ? (
              <button
                type="button"
                onClick={props.onOpenInvite}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Invite
              </button>
            ) : (
              <Link
                href="/dashboard/graph-management"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Invite
              </Link>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {visibleMembers.map((member) => {
          const label = member.name ?? member.email ?? 'Unknown'
          return (
            <div
              key={member.id}
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ${presenceClass(member.presence)}`}
              title={label}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/60 text-[11px] font-semibold">
                {initials(label)}
              </span>
              <span className="max-w-[160px] truncate">{label}</span>
            </div>
          )
        })}
        {extraCount > 0 ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            +{extraCount} more
          </div>
        ) : null}
      </div>
    </div>
  )
}

