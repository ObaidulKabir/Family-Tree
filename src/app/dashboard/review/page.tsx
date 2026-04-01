import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { getPersonDetails } from '@/actions/family'
import { resolvePersonFieldConflict, resolvePersonLinkDecision } from '@/actions/review'
import { prisma } from '@/lib/prisma'
import { getFieldConflictDetails, groupClaimsByPerson } from '@/lib/resolution'

type ReviewPerson = {
  id: string
  firstName: string
  lastName?: string | null
  reviewState?: {
    conflictFields?: string[]
    openLinkCount?: number
    needsReview?: boolean
    status?: string
  }
}

function formatFieldLabel(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase())
}

export default async function DashboardReviewPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/review')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rootPersonId: true },
  })

  if (!user?.rootPersonId) {
    redirect('/login')
  }

  const result = await getPersonDetails(user.rootPersonId)
  if ('error' in result) {
    return <div className="p-8 text-red-500">{result.error}</div>
  }

  const reviewPeople = ([
    result.person,
    ...result.parents,
    ...result.spouses,
    ...result.children,
    ...result.siblings,
  ] as ReviewPerson[])
    .filter((person) => person.reviewState?.needsReview)
    .filter((person, index, array) => array.findIndex((candidate) => candidate.id === person.id) === index)

  const reviewPersonIds = reviewPeople.map((person) => person.id)

  const [reviewClaims, reviewLinks] = await Promise.all([
    prisma.personClaim.findMany({
      where: {
        personId: { in: reviewPersonIds.length ? reviewPersonIds : ['__none__'] },
        resolutionStatus: { not: 'REJECTED' },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.personLink.findMany({
      where: {
        OR: [
          { leftPersonId: { in: reviewPersonIds.length ? reviewPersonIds : ['__none__'] } },
          { rightPersonId: { in: reviewPersonIds.length ? reviewPersonIds : ['__none__'] } },
        ],
      },
      include: {
        leftPerson: {
          select: { id: true, firstName: true, lastName: true },
        },
        rightPerson: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const claimsByPerson = groupClaimsByPerson(reviewClaims)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">Review family updates</h1>
            <p className="mt-2 text-sm text-gray-600">
              Resolve suggested changes and linked profiles without interrupting your tree work.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white">
            Back to tree
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {reviewPeople.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">No updates need review</h2>
              <p className="mt-2 text-sm text-gray-600">
                Invitation links, claim conflicts, and possible migrations will appear here when action is needed.
              </p>
            </div>
          ) : (
            reviewPeople.map((person) => (
              <div key={person.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {person.firstName} {person.lastName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {(person.reviewState?.conflictFields?.length ?? 0) > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold uppercase tracking-wide text-amber-700">
                          {person.reviewState?.conflictFields?.length} field conflicts
                        </span>
                      ) : null}
                      {(person.reviewState?.openLinkCount ?? 0) > 0 ? (
                        <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold uppercase tracking-wide text-blue-700">
                          {person.reviewState?.openLinkCount} possible links
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link href="/dashboard" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                    Open in tree
                  </Link>
                </div>

                {getFieldConflictDetails(claimsByPerson[person.id] ?? []).map((conflict) => (
                  <div key={`${person.id}-${conflict.field}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">{formatFieldLabel(conflict.field)}</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-white/70 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current tree value</div>
                        <div className="mt-2 text-sm font-medium text-gray-900">{String(conflict.winner.valueJson)}</div>
                        <form
                          action={async () => {
                            'use server'
                            await resolvePersonFieldConflict({
                              personId: person.id,
                              field: conflict.field,
                              winningClaimId: conflict.winner.id,
                              decision: 'keep_current',
                            })
                          }}
                          className="mt-3"
                        >
                          <button className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Keep current value
                          </button>
                        </form>
                      </div>
                      <div className="space-y-3">
                        {conflict.alternatives.map((alternative) => (
                          <div key={alternative.id} className="rounded-lg border border-white/70 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested value</div>
                            <div className="mt-2 text-sm font-medium text-gray-900">{String(alternative.valueJson)}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              Ranked from a contributor at distance {alternative.computedDistance ?? alternative.assertedDistance ?? 'unknown'}.
                            </div>
                            <form
                              action={async () => {
                                'use server'
                                await resolvePersonFieldConflict({
                                  personId: person.id,
                                  field: conflict.field,
                                  winningClaimId: alternative.id,
                                  decision: 'use_suggested',
                                })
                              }}
                              className="mt-3"
                            >
                              <button className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700">
                                Use suggested value
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {reviewLinks
                  .filter((link) => (link.leftPersonId === person.id || link.rightPersonId === person.id) && link.resolutionStatus === 'OPEN')
                  .map((link) => {
                    const counterpart = link.leftPersonId === person.id ? link.rightPerson : link.leftPerson

                    return (
                      <div key={link.id} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <div className="text-sm font-semibold text-blue-900">Possible duplicate</div>
                        <div className="mt-2 text-sm text-blue-900">
                          Review whether {person.firstName} {person.lastName} and {counterpart.firstName} {counterpart.lastName} represent the same person.
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <form
                            action={async () => {
                              'use server'
                              await resolvePersonLinkDecision({
                                linkId: link.id,
                                decision: 'same_person',
                              })
                            }}
                          >
                            <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                              Same person
                            </button>
                          </form>
                          <form
                            action={async () => {
                              'use server'
                              await resolvePersonLinkDecision({
                                linkId: link.id,
                                decision: 'different_people',
                              })
                            }}
                          >
                            <button className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-white">
                              Different people
                            </button>
                          </form>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

