'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'

import {
  createGraphInvitation,
  getGraphManagementPanelData,
  removeGraphContributor,
  renameGraph,
  revokeGraphInvitation,
  updateGraphMembershipRole,
} from '@/actions/graphManagement'
import GraphSwitcher from '@/components/graph/GraphSwitcher'

type PanelData = Awaited<ReturnType<typeof getGraphManagementPanelData>>
export type GraphManagementPanelData = PanelData & { error: null }

function buildInviteEmailHref(email: string, graphName: string, inviteLink: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Invitation to collaborate on ${graphName}`)}&body=${encodeURIComponent(`Open this secure link to join the family graph:\n\n${inviteLink}`)}`
}

function buildWhatsAppHref(graphName: string, inviteLink: string) {
  return `https://wa.me/?text=${encodeURIComponent(`Join the "${graphName}" family graph using this secure invitation link: ${inviteLink}`)}`
}

function formatPresence(presence: string) {
  if (presence === 'online') return 'bg-emerald-50 text-emerald-700'
  if (presence === 'away') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function formatInvitationStatus(status: string, isExpired: boolean) {
  if (status === 'REVOKED') return 'bg-rose-50 text-rose-700'
  if (status === 'ACCEPTED') return 'bg-emerald-50 text-emerald-700'
  if (isExpired) return 'bg-amber-50 text-amber-700'
  return 'bg-indigo-50 text-indigo-700'
}

export default function GraphManagementPanel(props: {
  initialData: GraphManagementPanelData
  currentGraphId?: string | null
  availableGraphs: Array<{ id: string; name: string; role: string }>
}) {
  const { initialData } = props
  const [data, setData] = useState(initialData)
  const [graphName, setGraphName] = useState(initialData.graph.name)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('EDITOR')
  const [latestInviteLink, setLatestInviteLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const contributorCount = useMemo(
    () => data.memberships.filter((membership) => membership.status === 'ACTIVE').length,
    [data.memberships]
  )

  const refreshPanel = () => {
    startTransition(async () => {
      const result = await getGraphManagementPanelData()
      if (!result.error) {
        const nextData = result as GraphManagementPanelData
        setData(nextData)
        setGraphName(nextData.graph.name)
      }
    })
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshPanel()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  const runAction = async (action: () => Promise<{ success?: boolean; error?: string | null; link?: string }>, successMessage: string) => {
    setError(null)
    setMessage(null)

    const result = await action()
    if (result.error) {
      setError(result.error)
      return
    }

    if (result.link) {
      setLatestInviteLink(result.link)
    }

    setMessage(successMessage)
    refreshPanel()
  }

  const copyInviteLink = async (inviteLink: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setMessage('Invitation link copied.')
      setError(null)
    } catch {
      setError('Failed to copy invitation link.')
    }
  }

  const shareInviteLink = async (inviteLink: string) => {
    if (!navigator.share) {
      await copyInviteLink(inviteLink)
      return
    }

    try {
      await navigator.share({
        title: `Invitation to ${data.graph.name}`,
        text: `Join the "${data.graph.name}" family graph.`,
        url: inviteLink,
      })
      setMessage('Invitation link shared.')
      setError(null)
    } catch {
      return
    }
  }

  const getInvitationLink = (token: string) => {
    if (typeof window === 'undefined') {
      return `/invite/graph/${token}`
    }

    return `${window.location.origin}/invite/graph/${token}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 w-fit">
              Graph owner controls
            </div>
            <h1 className="mt-4 text-3xl font-serif font-bold text-slate-900">{data.graph.name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage contributors, invitations, permissions, collaboration status, and audit history for this family graph.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-start lg:justify-end">
              <GraphSwitcher currentGraphId={props.currentGraphId} graphs={props.availableGraphs} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">People</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.graph.counts.people}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Families</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.graph.counts.families}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Contributors</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{contributorCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Pending invites</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.invitations.filter((invitation) => invitation.status === 'PENDING' && !invitation.isExpired).length}</div>
            </div>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Graph settings</h2>
                  <p className="mt-1 text-sm text-slate-500">Rename the graph and keep the shared workspace clearly labeled.</p>
                </div>
                <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Back to tree
                </Link>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={graphName}
                  onChange={(event) => setGraphName(event.target.value)}
                  placeholder="Graph name"
                />
                <button
                  disabled={isPending}
                  onClick={() => runAction(() => renameGraph(graphName), 'Graph name updated.')}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save name
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contributor invitations</h2>
                <p className="mt-1 text-sm text-slate-500">Create a secure invitation, then send it by email or share the link through WhatsApp and other messaging apps.</p>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.6fr_auto]">
                <input
                  type="email"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="contributor@example.com"
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                >
                  <option value="EDITOR">Editor</option>
                  <option value="COMMENTER">Commenter</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  disabled={isPending}
                  onClick={() => runAction(() => createGraphInvitation(inviteEmail, inviteRole), 'Invitation created.')}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create invite
                </button>
              </div>
              {latestInviteLink ? (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="text-sm font-medium text-indigo-900">Latest invitation link</div>
                  <div className="mt-2 break-all text-xs text-indigo-700">{latestInviteLink}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void copyInviteLink(latestInviteLink)}
                      className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                    >
                      Copy link
                    </button>
                    <a
                      href={buildInviteEmailHref(inviteEmail, data.graph.name, latestInviteLink)}
                      className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                    >
                      Email invite
                    </a>
                    <a
                      href={buildWhatsAppHref(data.graph.name, latestInviteLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                    >
                      WhatsApp
                    </a>
                    <button
                      onClick={() => void shareInviteLink(latestInviteLink)}
                      className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                    >
                      More apps
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {data.invitations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    No invitations yet.
                  </div>
                ) : (
                  data.invitations.map((invitation) => (
                    <div key={invitation.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-slate-900">{invitation.email}</div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${formatInvitationStatus(invitation.status, invitation.isExpired)}`}>
                              {invitation.isExpired && invitation.status === 'PENDING' ? 'expired' : invitation.status.toLowerCase()}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                              {invitation.role.toLowerCase()}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Expires {new Date(invitation.expiresAt).toLocaleString()}
                          </div>
                          {invitation.invitedUser?.name || invitation.invitedUser?.email ? (
                            <div className="mt-1 text-xs text-slate-500">
                              Accepted by {invitation.invitedUser?.name ?? invitation.invitedUser?.email}
                            </div>
                          ) : null}
                          {invitation.status === 'PENDING' && !invitation.isExpired ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => void copyInviteLink(getInvitationLink(invitation.token))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Copy link
                              </button>
                              <a
                                href={buildInviteEmailHref(invitation.email, data.graph.name, getInvitationLink(invitation.token))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Email invite
                              </a>
                              <a
                                href={buildWhatsAppHref(data.graph.name, getInvitationLink(invitation.token))}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                WhatsApp
                              </a>
                              <button
                                onClick={() => void shareInviteLink(getInvitationLink(invitation.token))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                More apps
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {invitation.status === 'PENDING' && !invitation.isExpired ? (
                          <button
                            disabled={isPending}
                            onClick={() => runAction(() => revokeGraphInvitation(invitation.id), 'Invitation revoked.')}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contributors</h2>
                <p className="mt-1 text-sm text-slate-500">Monitor live collaboration presence, update permissions, and revoke access when needed.</p>
              </div>
              <div className="mt-4 space-y-3">
                {data.memberships.map((membership) => (
                  <div key={membership.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-900">{membership.user.name ?? membership.user.email ?? 'Contributor'}</div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${formatPresence(membership.presence)}`}>
                            {membership.presence}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            {membership.status.toLowerCase()}
                          </span>
                          <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                            {membership.role.toLowerCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {membership.user.email ?? 'No email'} • Last active {membership.lastActivityAt ? new Date(membership.lastActivityAt).toLocaleString() : 'never'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {membership.role !== 'ADMIN' ? (
                          <>
                            <select
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={membership.role}
                              onChange={(event) => {
                                void runAction(
                                  () => updateGraphMembershipRole(membership.id, event.target.value),
                                  'Contributor role updated.'
                                )
                              }}
                            >
                              <option value="EDITOR">Editor</option>
                              <option value="COMMENTER">Commenter</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                            <button
                              disabled={isPending}
                              onClick={() => runAction(() => removeGraphContributor(membership.id), 'Contributor access removed.')}
                              className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">
                            Graph owner
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Real-time collaboration</h2>
              <p className="mt-1 text-sm text-slate-500">Presence updates refresh automatically to show who is online, away, or offline.</p>
              <div className="mt-4 space-y-2">
                {data.memberships.filter((membership) => membership.status === 'ACTIVE').map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{membership.user.name ?? membership.user.email}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${formatPresence(membership.presence)}`}>
                      {membership.presence}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Administrative audit log</h2>
              <p className="mt-1 text-sm text-slate-500">Every graph administration event is recorded for traceability.</p>
              <div className="mt-4 space-y-3">
                {data.auditLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    No audit events yet.
                  </div>
                ) : (
                  data.auditLogs.map((audit) => (
                    <div key={audit.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm font-medium text-slate-900">{audit.action.replaceAll('_', ' ').toLowerCase()}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {audit.actorUser?.name ?? audit.actorUser?.email ?? 'System'} • {new Date(audit.createdAt).toLocaleString()}
                      </div>
                      {audit.detailsJson ? (
                        <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{JSON.stringify(audit.detailsJson, null, 2)}</pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

