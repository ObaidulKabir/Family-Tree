import Link from 'next/link'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { getPasswordResetTokenState } from '@/actions/auth'

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenState = await getPasswordResetTokenState(token)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      {'error' in tokenState ? (
        <div className="w-full max-w-md rounded shadow-md bg-white p-8 text-center">
          <h2 className="text-2xl font-bold">Reset password</h2>
          <p className="mt-4 text-sm text-red-500">{tokenState.error}</p>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <Link href="/forgot-password" className="text-indigo-600 hover:underline">
              Request a new link
            </Link>
            <Link href="/login" className="text-slate-600 hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <ResetPasswordForm token={token} email={tokenState.email} />
      )}
    </div>
  )
}

