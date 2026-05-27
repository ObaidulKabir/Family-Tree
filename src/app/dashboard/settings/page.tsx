import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
import EmailVerificationPanel from '@/components/auth/EmailVerificationPanel'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/settings')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerified: true,
    },
  })

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900">Account security</h1>
            <p className="mt-2 text-sm text-slate-500">Manage your password and account access.</p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Back to dashboard
          </Link>
        </div>

        <EmailVerificationPanel email={user?.email} isVerified={Boolean(user?.emailVerified)} />
        <ChangePasswordForm isEmailVerified={Boolean(user?.emailVerified)} />
      </div>
    </div>
  )
}

