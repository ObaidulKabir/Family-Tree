'use client'

import Link from 'next/link'
import { useState } from 'react'

import { requestPasswordReset } from '@/actions/auth'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      formData.set('email', email)

      const result = await requestPasswordReset(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      setMessage(
        result.message ??
          'If an account exists for that email, you will receive an email with instructions to continue.'
      )
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
        <p className="mt-2 text-sm text-gray-500">Enter your account email and we will email you a secure reset link.</p>
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
          {loading ? 'Sending email...' : 'Send reset email'}
        </button>
      </form>

      <div className="text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">Back to login</Link>
      </div>
    </div>
  )
}

