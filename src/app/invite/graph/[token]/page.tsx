import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { acceptGraphInvitation } from '@/actions/graphManagement'
import { prisma } from '@/lib/prisma'

export default async function GraphInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/graph/${token}`)}`)
  }

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
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div><span className="font-medium">Invited email:</span> {invitation.email}</div>
          <div className="mt-1"><span className="font-medium">Status:</span> {invitation.status}</div>
          <div className="mt-1"><span className="font-medium">Expires:</span> {invitation.expiresAt.toLocaleString()}</div>
        </div>

        <form action={handleAccept} className="mt-8 flex flex-col gap-3">
          <button className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700">
            Accept and open graph
          </button>
          <Link href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
            Return to dashboard
          </Link>
        </form>
      </div>
    </div>
  )
}

