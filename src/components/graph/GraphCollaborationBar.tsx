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
    <div className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active graph</div>
              <div className="text-base font-semibold text-slate-900 truncate">{props.data.graph.name}</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 shrink-0">
              <Shield size={12} />
              {roleLabel(props.data.me.role)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users size={14} />
              {props.data.members.length} collaborators
            </span>
            {props.data.me.canInvite && props.data.pendingInvites > 0 ? (
              <span>• {props.data.pendingInvites} pending invites</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/review"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList size={16} />
            <span className="hidden sm:inline">Review</span>
            {props.data.reviewCount ? (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {props.data.reviewCount}
              </span>
            ) : null}
          </Link>
          <button
            onClick={props.onOpenActivity}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            type="button"
          >
            <Activity size={16} />
            <span className="hidden sm:inline">Activity</span>
          </button>
          {props.data.me.canInvite ? (
            props.onOpenInvite ? (
              <button
                type="button"
                onClick={props.onOpenInvite}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Invite
              </button>
            ) : (
              <Link
                href="/dashboard/graph-management"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Invite
              </Link>
            )
          ) : null}
        </div>
      </div>

      {props.data.members.length > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">Online status</div>
          <div className="flex items-center -space-x-2">
            {visibleMembers.map((member) => {
              const label = member.name ?? member.email ?? 'Unknown'
              return (
                <div
                  key={member.id}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white text-[10px] font-semibold ${presenceClass(member.presence)}`}
                  title={label}
                >
                  {initials(label)}
                </div>
              )
            })}
            {extraCount > 0 ? (
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 ring-2 ring-white">
                +{extraCount}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

