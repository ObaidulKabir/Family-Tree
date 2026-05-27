'use client'

import { useEffect, useMemo, useState } from 'react'

import { Check, Copy, X } from 'lucide-react'

import { createGraphInvitation } from '@/actions/graphManagement'

export default function GraphInviteQuickModal(props: {
  graphName: string
  allowedInviteRoles: string[]
  onClose: () => void
}) {
  const availableRoles = useMemo(
    () => (props.allowedInviteRoles.length > 0 ? props.allowedInviteRoles : ['VIEWER']),
    [props.allowedInviteRoles]
  )
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(availableRoles[0])
  const [inviteLink, setInviteLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRole(availableRoles[0])
  }, [availableRoles])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await createGraphInvitation(email, role)
      if ('error' in result) {
        setError(result.error ?? 'Failed to create invitation')
      } else if (result.link) {
        setInviteLink(result.link)
      }
    } catch {
      setError('Failed to create invitation')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const openEmail = () => {
    if (!inviteLink || !email) return
    const subject = `Invitation to collaborate on ${props.graphName}`
    const body = `Open this link to join the family graph:\n\n${inviteLink}\n`
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite collaborators</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{props.graphName}</div>
            <div className="mt-1 text-sm text-slate-600">Create a secure invitation link to share.</div>
            <div className="mt-2 text-xs text-slate-500">
              Allowed roles: {availableRoles.map((item) => item.toLowerCase()).join(', ')}
            </div>
          </div>
          <button onClick={props.onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!inviteLink ? (
            <form onSubmit={handleInvite} className="space-y-4">
              {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contributor@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {availableRoles.map((allowedRole) => (
                    <option key={allowedRole} value={allowedRole}>
                      {allowedRole.charAt(0)}{allowedRole.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create invite link'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Invitation ready to share.
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  value={inviteLink}
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
                  aria-label="Copy link"
                >
                  {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                </button>
              </div>
              {email ? (
                <button
                  type="button"
                  onClick={openEmail}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open email app
                </button>
              ) : null}
              <button
                type="button"
                onClick={props.onClose}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

