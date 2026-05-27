'use client'

import Link from 'next/link'
import { useState } from 'react'

import { requestPasswordReset } from '@/actions/auth'

function buildMailtoHref(email: string, resetLink: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your password reset link')}&body=${encodeURIComponent(`Use this secure link to reset your password:\n\n${resetLink}`)}`
}

function buildVerificationMailtoHref(email: string, verificationLink: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Verify your FamilyExplorer account')}&body=${encodeURIComponent(`Open this secure link to verify your email address:\n\n${verificationLink}`)}`
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [verificationLink, setVerificationLink] = useState('')
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    setResetLink('')
    setVerificationLink('')
    setDeliveryEmail('')

    try {
      const formData = new FormData()
      formData.set('email', email)

      const result = await requestPasswordReset(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      setMessage(result.message ?? 'If an account exists for that email, a reset link is now ready.')
      if ('resetLink' in result && result.resetLink) {
        setResetLink(result.resetLink)
      }
      if ('verificationLink' in result && result.verificationLink) {
        setVerificationLink(result.verificationLink)
      }
      if ('email' in result && result.email) {
        setDeliveryEmail(result.email)
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded shadow-md bg-white p-8 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Forgot password</h2>
        <p className="mt-2 text-sm text-gray-500">Enter your account email to create a secure password reset link.</p>
      </div>

      {error ? <p className="text-center text-red-500">{error}</p> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Creating reset link...' : 'Create reset link'}
        </button>
      </form>

      {resetLink ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm font-medium text-indigo-900">Reset link</div>
          <div className="mt-2 break-all text-xs text-indigo-700">{resetLink}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(resetLink)}
              className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
            >
              Copy link
            </button>
            {deliveryEmail ? (
              <a
                href={buildMailtoHref(deliveryEmail, resetLink)}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-white"
              >
                Email link
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {verificationLink ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-900">Verify email first</div>
          <div className="mt-2 break-all text-xs text-amber-700">{verificationLink}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(verificationLink)}
              className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-white"
              type="button"
            >
              Copy link
            </button>
            {deliveryEmail ? (
              <a
                href={buildVerificationMailtoHref(deliveryEmail, verificationLink)}
                className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-white"
              >
                Email link
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">Back to login</Link>
      </div>
    </div>
  )
}

