import Link from 'next/link'
import { redirect } from 'next/navigation'

function extractToken(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    const token = parts[0] === 'invite' ? parts[1] ?? '' : parts.at(-1) ?? ''
    return token
  } catch {
    const parts = raw.split('/').filter(Boolean)
    if (parts[0] === 'invite') return parts[1] ?? ''
    return parts.at(-1) ?? raw
  }
}

export default function InviteEntryPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 bg-white rounded shadow-md p-8">
        <h1 className="text-2xl font-bold text-center">Open Invitation</h1>
        <p className="text-sm text-gray-600 text-center">
          Paste an invitation link or token to continue.
        </p>

        <form
          action={async (formData) => {
            'use server'
            const raw = String(formData.get('token') ?? '')
            const token = extractToken(raw)
            if (!token) redirect('/')
            redirect(`/invite/${token}`)
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Invite link or token</label>
            <input
              name="token"
              type="text"
              required
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
              placeholder="https://your-app.com/invite/… or token"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Continue
          </button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-indigo-600 hover:underline">
            Login
          </Link>
          <span className="mx-2 text-gray-400">|</span>
          <Link href="/register" className="text-indigo-600 hover:underline">
            Register
          </Link>
        </div>
      </div>
    </div>
  )
}

