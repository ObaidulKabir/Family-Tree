'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { resetPassword } from '@/actions/auth'

export default function ResetPasswordForm({ token, email }: { token: string; email?: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.set('token', token)
      formData.set('password', password)
      formData.set('confirmPassword', confirmPassword)

      const result = await resetPassword(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess('Password updated successfully. Redirecting to login...')
      setTimeout(() => {
        router.push('/login')
      }, 1200)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded shadow-md bg-white p-8 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Reset password</h2>
        <p className="mt-2 text-sm text-gray-500">
          {email ? `Create a new password for ${email}.` : 'Create a new password for your account.'}
        </p>
      </div>

      {error ? <p className="text-center text-red-500">{error}</p> : null}
      {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">New password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Updating password...' : 'Update password'}
        </button>
      </form>

      <div className="text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">Back to login</Link>
      </div>
    </div>
  )
}

