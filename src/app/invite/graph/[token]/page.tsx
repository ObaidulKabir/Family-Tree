import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { acceptGraphInvitation } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'
import { SignOut } from '@/components/auth/SignOut'

export default async function GraphInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { token } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const session = await auth()
  const pageError = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const invitation = await prisma.graphInvitation.findUnique({
    where: { token },
    include: {
      graph: {
        select: {
          id: true,
          name: true,
          adminUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!invitation) {
    return <div className="p-8 text-center text-red-500">Invitation not found.</div>
  }

  const now = new Date()
  const isExpired = invitation.expiresAt.getTime() <= now.getTime()
  const isRevoked = Boolean(invitation.revokedAt) || invitation.status === 'REVOKED'
  const isConsumable = invitation.status === 'PENDING' && !isExpired && !isRevoked
  const callbackUrl = `/invite/graph/${token}`
  const registerHref = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invitation.email)}`
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invitation.email)}`
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null
  const invitedEmail = invitation.email.trim().toLowerCase()
  const emailMatches = Boolean(sessionEmail && sessionEmail === invitedEmail)
  const canAccept = Boolean(session?.user && isConsumable && emailMatches)
  if (!invitation.openedAt && invitation.status === 'PENDING' && invitation.expiresAt.getTime() > now.getTime() && !invitation.revokedAt) {
    await prisma.graphInvitation.update({
      where: { id: invitation.id },
      data: { openedAt: now },
    })
  }

  async function handleAccept() {
    'use server'

    const result = await acceptGraphInvitation(token)
    if ('error' in result) {
      redirect(`/invite/graph/${token}?error=${encodeURIComponent(result.error)}`)
    }
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 w-fit">
          Graph invitation
        </div>
        <h1 className="mt-4 text-3xl font-serif font-bold text-slate-900">{invitation.graph.name}</h1>
        <p className="mt-3 text-sm text-slate-600">
          You were invited as <span className="font-semibold">{invitation.role.toLowerCase()}</span> by{' '}
          {invitation.graph.adminUser.name ?? invitation.graph.adminUser.email ?? 'the graph admin'}.
        </p>
        {pageError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        ) : null}
        {!session?.user ? (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-900">
            <div className="font-semibold">Create an account or sign in to accept this invitation</div>
            <div className="mt-1 text-xs text-indigo-900/80">
              Use <span className="font-semibold">{invitation.email}</span> so the app can match you to this invitation.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={registerHref}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create account
              </Link>
              <Link
                href={loginHref}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : !emailMatches ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Account mismatch</div>
            <div className="mt-1 text-xs text-amber-900/80">
              Signed in as {session.user.email ?? 'unknown email'}, but this invitation is for {invitation.email}.
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-amber-900/80">
                Sign out, then{' '}
                <Link href={registerHref} className="font-semibold underline">
                  create an account
                </Link>{' '}
                with the invited email (or{' '}
                <Link href={loginHref} className="font-semibold underline">
                  sign in
                </Link>
                ) and reopen this link.
              </div>
              <SignOut />
            </div>
          </div>
        ) : null}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div><span className="font-medium">Invited email:</span> {invitation.email}</div>
          <div className="mt-1"><span className="font-medium">Status:</span> {invitation.status}</div>
          <div className="mt-1"><span className="font-medium">Expires:</span> {invitation.expiresAt.toLocaleString()}</div>
        </div>

        <form action={handleAccept} className="mt-8 flex flex-col gap-3">
          <button
            disabled={!canAccept}
            className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Accept and open graph
          </button>
          <Link href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
            Return to dashboard
          </Link>
        </form>
        {!canAccept ? (
          <div className="mt-4 text-xs text-slate-500">
            Accepting the invitation requires an account signed in with the invited email address.
          </div>
        ) : null}
      </div>
    </div>
  )
}

