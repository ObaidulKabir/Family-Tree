'use client'

import { useState } from 'react'

import { requestEmailVerification } from '@/actions/auth'

function buildMailtoHref(email: string, verificationLink: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Verify your FamilyExplorer account')}&body=${encodeURIComponent(`Open this secure link to verify your email address:\n\n${verificationLink}`)}`
}

export default function EmailVerificationPanel(props: {
  email?: string | null
  isVerified: boolean
}) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [verificationLink, setVerificationLink] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Email verification</h2>
        <p className="mt-1 text-sm text-slate-500">
          {props.isVerified
            ? 'Your email address is verified.'
            : 'Verify your email address before changing or recovering your password.'}
        </p>
      </div>

      {props.isVerified ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {props.email ?? 'This account'} is verified.
        </div>
      ) : (
        <>
          {error ? <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{message}</div> : null}

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              setError('')
              setMessage('')
              setVerificationLink('')

              try {
                const formData = new FormData()
                const result = await requestEmailVerification(formData)
                if ('error' in result && typeof result.error === 'string' && result.error) {
                  setError(result.error)
                  return
                }

                setMessage(result.message ?? 'Verification link created.')
                if ('verificationLink' in result && result.verificationLink) {
                  setVerificationLink(result.verificationLink)
                }
              } catch {
                setError('Something went wrong.')
              } finally {
                setLoading(false)
              }
            }}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating verification link...' : 'Create verification link'}
          </button>

          {verificationLink ? (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-sm font-medium text-indigo-900">Verification link</div>
              <div className="mt-2 break-all text-xs text-indigo-700">{verificationLink}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(verificationLink)}
                  className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                  type="button"
                >
                  Copy link
                </button>
                {props.email ? (
                  <a
                    href={buildMailtoHref(props.email, verificationLink)}
                    className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
                  >
                    Email link
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

