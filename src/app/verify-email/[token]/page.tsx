import Link from 'next/link'

import { getEmailVerificationTokenState, verifyEmailToken } from '@/actions/auth'

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ callbackUrl?: string }>
}) {
  const { token } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const callbackUrl =
    typeof resolvedSearchParams.callbackUrl === 'string' && resolvedSearchParams.callbackUrl.startsWith('/')
      ? resolvedSearchParams.callbackUrl
      : '/dashboard'

  const tokenState = await getEmailVerificationTokenState(token)

  if (!tokenState.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded shadow-md bg-white p-8 text-center">
          <h2 className="text-2xl font-bold">Verify email</h2>
          <p className="mt-4 text-sm text-red-500">{tokenState.error}</p>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <Link href="/register" className="text-indigo-600 hover:underline">
              Back to register
            </Link>
            <Link href="/login" className="text-slate-600 hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const result = await verifyEmailToken(token)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded shadow-md bg-white p-8 text-center">
        <h2 className="text-2xl font-bold">Verify email</h2>
        {'error' in result ? (
          <>
            <p className="mt-4 text-sm text-red-500">{result.error}</p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <Link href="/register" className="text-indigo-600 hover:underline">
                Back to register
              </Link>
              <Link href="/login" className="text-slate-600 hover:underline">
                Back to login
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {result.email} is now verified. You can sign in and manage password recovery securely.
            </div>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(result.email)}`}
                className="text-indigo-600 hover:underline"
              >
                Continue to login
              </Link>
              <Link href={callbackUrl} className="text-slate-600 hover:underline">
                View next page
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

