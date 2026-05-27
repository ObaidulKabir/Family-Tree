'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { getPersonDetails, searchPeopleInCurrentGraph } from '@/actions/family';
import { getGraphCollaborationBarData, touchGraphPresence } from '@/actions/graphManagement';
import { getLatestProfessionalPosition, normalizeProfessionalHistory } from '@/lib/personHistory';
import { User as UserIcon, Heart, Plus, Share2, Edit2, X } from 'lucide-react';
import AddPersonModal from './AddPersonModal';
import InviteModal from './InviteModal';
import EditPersonModal from './EditPersonModal';
import DivorceModal from './DivorceModal';
import AssociateChildModal from './AssociateChildModal';
import { getAssociableChildrenForSpouse } from '@/lib/familyAssociation';
import GraphCollaborationBar from '@/components/graph/GraphCollaborationBar';
import GraphActivityDrawer from '@/components/graph/GraphActivityDrawer';
import GraphInviteQuickModal from '@/components/graph/GraphInviteQuickModal';

type DateLike = string | Date | null | undefined;

type PhotoLike = {
  id?: string;
  url: string;
  date?: DateLike;
};

type PersonLike = {
  id: string;
  firstName: string;
  lastName?: string | null;
  title?: string | null;
  educationHistory?: unknown;
  professionalHistory?: unknown;
  nickName?: string | null;
  dateOfBirth?: DateLike;
  placeOfBirth?: string | null;
  dateOfDeath?: DateLike;
  placeOfDeath?: string | null;
  updatedAt?: DateLike;
  childOfFamilyId?: string | null;
  photos?: PhotoLike[];
  isDivorced?: boolean;
  familyId?: string;
  marriageDate?: DateLike;
  marriagePlace?: string | null;
  marriageId?: string;
  divorceDate?: DateLike;
  divorcePlace?: string | null;
  divorceId?: string;
  reviewState?: {
    conflictFields?: string[];
    openLinkCount?: number;
    needsReview?: boolean;
    status?: 'clean' | 'linked' | 'needs_review';
  };
};

type FamilyTreeData = {
  error?: string;
  person: PersonLike;
  parents: PersonLike[];
  spouses: PersonLike[];
  children: PersonLike[];
  siblings: PersonLike[];
  reviewSummary?: {
    peopleWithConflicts: number;
    peopleWithLinks: number;
    totalConflictFields: number;
    totalOpenLinks: number;
  };
  graphPermission?: {
    graphId: string;
    role: string;
    canEdit: boolean;
    canManage: boolean;
  };
};

type CollaborationBarState = {
  graph: { id: string; name: string };
  me: { role: string; canManage: boolean; canInvite: boolean; allowedInviteRoles: string[] };
  members: Array<{ id: string; name?: string | null; email?: string | null; role: string; presence: 'online' | 'away' | 'offline' }>;
  pendingInvites: number;
  activity: Array<{ id: string; createdAt: string; action: string; entityType: string; entityId?: string | null; actor?: { id: string; name?: string | null; email?: string | null } | null }>;
};

function formatDisplayDate(value: DateLike) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'dd-MMM-yyyy');
}

function isPersonDeceased(person: PersonLike) {
  return Boolean(person.dateOfDeath);
}

function getLifeSummary(person: PersonLike) {
  const born = formatDisplayDate(person.dateOfBirth);
  const died = formatDisplayDate(person.dateOfDeath);

  if (died) {
    return `${born ? born : 'Date unknown'} — ${died}`;
  }

  if (born) {
    return `Born: ${born}`;
  }

  return 'Living'
}

function getLatestPositionLabel(person: PersonLike) {
  const latest = getLatestProfessionalPosition(normalizeProfessionalHistory(person.professionalHistory))
  if (!latest) return null

  return [latest.position, latest.company].filter(Boolean).join(' @ ')
}

function normalizePhotoUrl(value: string) {
  const cleaned = value.trim().replaceAll('\\', '/')
  if (!cleaned) return null
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('data:')) return cleaned
  if (cleaned.startsWith('/')) return cleaned

  const uploadsIndex = cleaned.indexOf('/uploads/')
  if (uploadsIndex >= 0) return cleaned.slice(uploadsIndex)

  return `/${cleaned}`
}

function getPrimaryPhotoUrl(person: PersonLike) {
  const photos = Array.isArray(person.photos) ? person.photos : []
  const primary = photos[0]
  if (!primary) return null
  if (primary.id) return `/api/photo/${primary.id}`
  return normalizePhotoUrl(primary.url)
}

function getRelationshipSummary(person: PersonLike) {
  if (person.isDivorced) {
    return `Divorced${person.divorceDate ? ` • ${formatDisplayDate(person.divorceDate)}` : ''}`;
  }
  return `Married${person.marriageDate ? ` • ${formatDisplayDate(person.marriageDate)}` : ''}`;
}

function getPersonCardDisplayName(person: PersonLike, mode: 'default' | 'nicknameOrFull') {
  const firstName = person.firstName?.trim() ?? ''
  const lastName = person.lastName?.trim() ?? ''
  const fullName = `${firstName} ${lastName}`.trim()

  if (mode === 'nicknameOrFull') {
    const nickName = person.nickName?.trim() ?? ''
    return nickName || fullName || firstName || lastName || 'Unknown'
  }

  return firstName || 'Unknown'
}

function buildRoleAliases(groups: Record<string, PersonLike[]>) {
  const roleMap = new Map<string, Set<string>>()

  for (const [role, people] of Object.entries(groups)) {
    for (const person of people) {
      if (!roleMap.has(person.id)) {
        roleMap.set(person.id, new Set())
      }
      roleMap.get(person.id)?.add(role)
    }
  }

  return roleMap
}

export default function FamilyTreeView({ initialPersonId }: { initialPersonId: string }) {
  const [currentPersonId, setCurrentPersonId] = useState(initialPersonId);
  const [data, setData] = useState<FamilyTreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName?: string | null; nickName?: string | null; dateOfBirth?: DateLike }>>([]);
  const [showResults, setShowResults] = useState(false);
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDivorceModal, setShowDivorceModal] = useState(false);
  const [showAssociateChildModal, setShowAssociateChildModal] = useState(false);
  const [selectedSpouse, setSelectedSpouse] = useState<PersonLike | null>(null);
  const [associationSpouse, setAssociationSpouse] = useState<PersonLike | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonLike | null>(null);
  const [openingEditModal, setOpeningEditModal] = useState(false);
  const [addRelationType, setAddRelationType] = useState<'PARENT' | 'CHILD' | 'SPOUSE' | null>(null);
  const [collabBar, setCollabBar] = useState<CollaborationBarState | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function loadPerson(id: string) {
    setLoading(true);
    const result = (await getPersonDetails(id)) as FamilyTreeData | { error: string };
    if (result && !('error' in result)) {
      setData(result);
    }
    setLoading(false);
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadPerson(currentPersonId);
    });
  }, [currentPersonId]);

  useEffect(() => {
    setCurrentPersonId(initialPersonId);
    setHighlightedPersonId(initialPersonId);
    setInviteOpen(false);
    setActivityOpen(false);
  }, [initialPersonId]);

  useEffect(() => {
    if (!data?.graphPermission?.graphId) return;

    void touchGraphPresence(currentPersonId);
    const intervalId = window.setInterval(() => {
      void touchGraphPresence(currentPersonId);
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [currentPersonId, data?.graphPermission?.graphId]);

  useEffect(() => {
    if (!data?.graphPermission?.graphId) return;
    let cancelled = false;
    const graphId = data.graphPermission.graphId;

    const load = async () => {
      const result = await getGraphCollaborationBarData(graphId);
      if (cancelled) return;
      if (result && result.error === null) {
        setCollabBar(result as CollaborationBarState);
      }
    };

    void load();
    const intervalId = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [data?.graphPermission?.graphId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const term = searchQuery.trim();
      if (!term) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      setSearchLoading(true);
      const res = await searchPeopleInCurrentGraph(term);
      if (cancelled) return;
      setSearchLoading(false);
      if (!res.error) {
        setSearchResults(res.people);
        setShowResults(true);
      }
    };
    const h = window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
  }, [searchQuery]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!searchContainerRef.current) return;
      if (event.target instanceof Node && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!highlightedPersonId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedPersonId(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedPersonId]);

  useEffect(() => {
    if (!highlightedPersonId) return;
    const target = document.querySelector(`[data-person-id="${highlightedPersonId}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [highlightedPersonId, data?.person?.id]);
  
  const handleAdd = (type: 'PARENT' | 'CHILD' | 'SPOUSE') => {
      setAddRelationType(type);
      setShowAddModal(true);
  };
  
  const handlePersonAdded = () => {
      setShowAddModal(false);
      loadPerson(currentPersonId);
  };

  const handleEdit = async (p: PersonLike) => {
      setOpeningEditModal(true);
      try {
        const latestDetails = await getPersonDetails(p.id);
        if (!('error' in latestDetails)) {
          setEditingPerson(latestDetails.person as PersonLike);
        } else {
          setEditingPerson(p);
        }
      } catch {
        setEditingPerson(p);
      } finally {
        setShowEditModal(true);
        setOpeningEditModal(false);
      }
  };

  const handlePersonUpdated = () => {
      setShowEditModal(false);
      setEditingPerson(null);
      loadPerson(currentPersonId);
  };

  const handleDivorce = (spouse: PersonLike) => {
      setSelectedSpouse(spouse);
      setShowDivorceModal(true);
  };

  const handleDivorceSuccess = () => {
      setShowDivorceModal(false);
      loadPerson(currentPersonId);
  };

  const handleAssociateChild = (spouse: PersonLike) => {
      setAssociationSpouse(spouse);
      setShowAssociateChildModal(true);
  };

  const handleAssociateChildSuccess = () => {
      setShowAssociateChildModal(false);
      setAssociationSpouse(null);
      loadPerson(currentPersonId);
  };

  if (loading) return <div className="flex h-96 items-center justify-center text-gray-400">Loading family data...</div>;
  if (!data) return <div className="flex h-96 items-center justify-center text-red-400">Person not found</div>;

  const { person, parents, spouses, children, siblings } = data;
  const reviewSummary = data.reviewSummary;
  const allowEdit = Boolean(data.graphPermission?.canEdit);
  const allowManage = Boolean(data.graphPermission?.canManage);
  const activeRole = collabBar?.me.role?.toLowerCase() ?? 'member'
  const canInvite = Boolean(collabBar?.me.canInvite)
  const allowedInviteRoles = collabBar?.me.allowedInviteRoles ?? []
  const roleAliases = buildRoleAliases({
      parent: parents,
      spouse: spouses,
      child: children,
      sibling: siblings
  })

  return (
    <div className="flex flex-col items-center gap-8 min-h-[600px] py-10">
      {collabBar ? (
        <>
          <GraphCollaborationBar
            data={{
              graph: collabBar.graph,
              me: collabBar.me,
              members: collabBar.members,
              pendingInvites: collabBar.pendingInvites,
              reviewCount: (reviewSummary?.totalConflictFields ?? 0) + (reviewSummary?.totalOpenLinks ?? 0),
            }}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenInvite={() => setInviteOpen(true)}
          />
          <GraphActivityDrawer
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
            graphName={collabBar.graph.name}
            items={collabBar.activity}
            onOpenPerson={(personId) => {
              setActivityOpen(false)
              setCurrentPersonId(personId)
              setHighlightedPersonId(personId)
            }}
          />
          {inviteOpen && collabBar.me.canInvite ? (
            <GraphInviteQuickModal
              graphName={collabBar.graph.name}
              allowedInviteRoles={collabBar.me.allowedInviteRoles}
              onClose={() => setInviteOpen(false)}
            />
          ) : null}
        </>
      ) : null}
      {!allowManage ? (
        <div
          className={`w-full max-w-5xl rounded-2xl border px-4 py-4 text-sm shadow-sm ${
            allowEdit
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-sky-200 bg-sky-50 text-sky-900'
          }`}
        >
          <div className="font-semibold">
            {allowEdit ? 'Editing access is limited in this graph' : 'This graph is view-only for your account'}
          </div>
          <div className="mt-1 text-xs">
            You are currently using this graph as an {activeRole}.{' '}
            {allowEdit
              ? canInvite
                ? `You can update family members here and invite ${allowedInviteRoles.map((role) => role.toLowerCase()).join(' or ')} contributors, but only a graph admin can manage contributor roles.`
                : 'You can update family members in this workspace, but only higher graph roles can invite contributors or manage permissions.'
              : canInvite
                ? `You can browse the family graph, review updates, and invite ${allowedInviteRoles.map((role) => role.toLowerCase()).join(' or ')} contributors from this workspace.`
                : 'You can browse the family graph and review updates here, but editing people, inviting contributors, and graph management are restricted to higher roles.'}
          </div>
          {!allowManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/review"
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  allowEdit
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                Open review inbox
              </Link>
              <Link
                href="/dashboard/graph-management"
                className="rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-xs font-medium hover:bg-white"
              >
                Switch graph or view permissions
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="w-full max-w-5xl">
        <div className="relative" ref={searchContainerRef}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            placeholder="Search people by name..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {searchLoading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Searching…</div>
          ) : null}
          {showResults && searchResults.length > 0 ? (
            <div className="absolute z-20 mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {searchResults.map((p) => {
                const display = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.nickName || 'Unknown'
                const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : undefined
                const subtitle = dob && !isNaN(dob.getTime()) ? `Born ${dob.getFullYear()}` : ''
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setShowResults(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setCurrentPersonId(p.id);
                      setHighlightedPersonId(p.id);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-indigo-50"
                  >
                    <span className="text-sm font-medium text-slate-900">{display}</span>
                    {subtitle ? <span className="text-xs text-slate-500">{subtitle}</span> : null}
                  </button>
                )
              })}
            </div>
          ) : showResults && searchQuery.trim() && !searchLoading ? (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
              No matches found.
            </div>
          ) : null}
        </div>
      </div>
      {(reviewSummary?.totalConflictFields || reviewSummary?.totalOpenLinks) ? (
        <div className="w-full max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-900">Review family updates</div>
            <div className="text-xs text-amber-800">
              {reviewSummary.totalConflictFields} field conflicts and {reviewSummary.totalOpenLinks} possible links need review.
            </div>
          </div>
          <Link href="/dashboard/review" className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            Open review inbox
          </Link>
        </div>
      ) : null}

      <div className="w-full overflow-x-auto pb-4">
        <div className="mx-auto min-w-[900px] flex flex-col items-center gap-12 px-4">
      {/* --- Generation 1: Parents --- */}
      <div className="flex flex-col items-center relative">
        <h3 className="absolute -top-8 text-xs font-bold text-gray-400 tracking-wider uppercase">Parents</h3>
        <div className="flex gap-8 items-end">
          {parents.length > 0 ? (
            <div className="flex gap-4 p-4 bg-white/50 rounded-xl border border-gray-100 shadow-sm">
              {parents.map((p: PersonLike) => (
                <PersonCard key={p.id} person={p} onClick={() => setCurrentPersonId(p.id)} onEdit={allowEdit ? () => handleEdit(p) : undefined} />
              ))}
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl">
               <span className="text-xs text-gray-400">No parents recorded</span>
            </div>
          )}
          {allowEdit && parents.length < 2 && (
             <AddButton onClick={() => handleAdd('PARENT')} label="Add Parent" small />
          )}
        </div>
        {parents.length > 0 && <div className="h-12 w-0.5 bg-gray-300 mt-2"></div>}
      </div>

      {/* --- Generation 2: Siblings + Focus + Spouses --- */}
      <div className="flex items-start gap-16 relative">
        {/* Connector Line Top Horizontal (if parents exist) */}
        {parents.length > 0 && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-full max-w-[50%] h-6 border-t-2 border-gray-300 rounded-t-xl"></div>
        )}

        {/* Siblings Group */}
        {siblings.length > 0 && (
            <div className="flex flex-col items-center">
                <h3 className="mb-2 text-xs font-bold text-gray-400 tracking-wider uppercase">Siblings</h3>
                <div className="flex gap-2 flex-wrap max-w-xs justify-center">
                    {siblings.map((s: PersonLike) => (
                        <PersonCard key={s.id} person={s} compact displayNameMode="nicknameOrFull" aliasRoles={[...(roleAliases.get(s.id) ?? [])].filter((role) => role !== 'sibling')} onClick={() => setCurrentPersonId(s.id)} onEdit={allowEdit ? () => handleEdit(s) : undefined} />
                    ))}
                </div>
            </div>
        )}
      
        {/* Main Focus Group */}
        <div className="flex flex-col items-center relative z-10">
            <div data-person-id={person.id} className={`flex flex-col items-center gap-4 p-4 rounded-2xl shadow-xl border ring-4 sm:flex-row sm:gap-6 sm:p-6 ${isPersonDeceased(person) ? 'bg-slate-50 border-slate-200 ring-slate-100' : 'bg-white border-indigo-50 ring-indigo-50/50'} ${highlightedPersonId === person.id ? 'ring-amber-200 border-amber-100 shadow-amber-100/40 shadow-xl' : ''}`}>
                
                {/* Focal Person */}
                <div className="flex flex-col items-center group">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden border-4 shadow-md relative group ${isPersonDeceased(person) ? 'bg-slate-200 border-slate-100' : 'bg-indigo-100 border-white'}`}>
                        {getPrimaryPhotoUrl(person) ? (
                            <>
                                <img src={getPrimaryPhotoUrl(person) ?? undefined} alt={person.firstName} className={`w-full h-full object-cover ${isPersonDeceased(person) ? 'grayscale' : ''}`} />
                                {person.photos?.[0]?.date && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1">
                                        {new Date(person.photos[0].date).getFullYear()}
                                    </div>
                                )}
                            </>
                        ) : (
                            <UserIcon size={40} className={isPersonDeceased(person) ? 'text-slate-500' : 'text-indigo-400'} />
                        )}
                    </div>
                    <h2 className={`text-center text-2xl font-serif font-bold ${isPersonDeceased(person) ? 'text-slate-800' : 'text-gray-800'}`}>{person.firstName} {person.lastName}</h2>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                        {person.title ? (
                          <p className={`text-sm font-medium ${isPersonDeceased(person) ? 'text-slate-600' : 'text-indigo-600'}`}>{person.title}</p>
                        ) : null}
                        {isPersonDeceased(person) ? (
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            In memory
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Living
                          </span>
                        )}
                    </div>
                    {getLatestPositionLabel(person) ? (
                      <p className="mt-1 text-center text-xs font-medium text-slate-500">{getLatestPositionLabel(person)}</p>
                    ) : null}
                    {person.nickName && <p className="text-xs text-gray-500 italic">&quot;{person.nickName}&quot;</p>}
                    <ReviewBadge person={person} />
                    
                    <div className="text-xs text-gray-400 mt-2 flex flex-col items-center gap-0.5">
                        {isPersonDeceased(person) ? (
                          <>
                            <span className="text-slate-600">{getLifeSummary(person)}</span>
                            {person.placeOfDeath ? <span className="text-gray-500">{person.placeOfDeath}</span> : null}
                          </>
                        ) : (
                          <>
                            <span>{person.dateOfBirth ? `Born: ${formatDisplayDate(person.dateOfBirth)}` : 'No DOB'}</span>
                            {person.placeOfBirth ? <span className="text-gray-500">{person.placeOfBirth}</span> : null}
                          </>
                        )}
                    </div>
                    
                    <div className="flex gap-2 mt-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                        <Link
                            href={`/dashboard/person/${person.id}`}
                            className="inline-flex items-center rounded-full px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Explore person"
                        >
                            Explore
                        </Link>
                        {allowEdit ? (
                            <button
                                onClick={() => handleEdit(person)}
                                disabled={openingEditModal}
                                className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Edit Details"
                            >
                                <Edit2 size={16} />
                            </button>
                        ) : null}
                        {allowManage ? (
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Invite to claim"
                            >
                                <Share2 size={16} />
                                <span className="text-xs font-medium">Invite to claim</span>
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Spouses */}
                {spouses.length > 0 && (
                    <>
                        <div className="h-16 w-px bg-gray-200"></div>
                        <div className="flex gap-4">
                            {spouses.map((s: PersonLike) => (
                                <div key={s.id} className="relative flex flex-col items-center group">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (allowEdit) handleDivorce(s); }}
                                        className={`mb-2 flex flex-col items-center text-xs ${allowEdit ? 'text-red-300 hover:text-red-400' : 'text-gray-300 cursor-default'}`}
                                        title="Edit relationship"
                                    >
                                        <Heart size={16} fill="currentColor" />
                                        <span className={`mt-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${s.isDivorced ? 'bg-red-100 text-red-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {getRelationshipSummary(s)}
                                        </span>
                                        {s.marriagePlace || s.divorcePlace ? (
                                            <span className="mt-1 text-[10px] text-gray-500">
                                                {s.isDivorced ? s.divorcePlace : s.marriagePlace}
                                            </span>
                                        ) : null}
                                    </button>
                                    <PersonCard person={s} aliasRoles={[...(roleAliases.get(s.id) ?? [])].filter((role) => role !== 'spouse')} onClick={() => setCurrentPersonId(s.id)} onEdit={allowEdit ? () => handleEdit(s) : undefined} />
                                    {allowEdit && getAssociableChildrenForSpouse(children, s.familyId).length > 0 ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAssociateChild(s); }}
                                            className="mt-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                                            title="Associate an existing child with this spouse"
                                        >
                                            Associate child
                                        </button>
                                    ) : null}
                                    {allowEdit ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDivorce(s); }}
                                            className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 shadow-sm transition-all"
                                            title={s.isDivorced ? 'Edit relationship' : 'Record divorce'}
                                        >
                                            <X size={12} />
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </>
                )}
                
                {allowEdit ? <div className="ml-2">
                    <AddButton onClick={() => handleAdd('SPOUSE')} label="Add Spouse" small />
                </div> : null}
            </div>
            
            {/* Connector Line Down to Children */}
            {(children.length > 0 || true) && <div className="h-12 w-0.5 bg-gray-300 mt-0"></div>}
        </div>
      </div>

      {/* --- Generation 3: Children --- */}
      <div className="flex flex-col items-center w-full relative">
         {children.length > 0 && (
             // Horizontal bar for children
             <div className="absolute -top-6 w-[80%] h-6 border-t-2 border-gray-300 rounded-t-xl"></div>
         )}
         
        <h3 className="mb-4 text-xs font-bold text-gray-400 tracking-wider uppercase">Children</h3>
        <div className="flex gap-6 flex-wrap justify-center">
          {children.map((c: PersonLike) => (
            <div key={c.id} className="relative pt-6">
                {/* Vertical line from horizontal bar to child */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-gray-300"></div>
                <PersonCard person={c} displayNameMode="nicknameOrFull" aliasRoles={[...(roleAliases.get(c.id) ?? [])].filter((role) => role !== 'child')} onClick={() => setCurrentPersonId(c.id)} onEdit={allowEdit ? () => handleEdit(c) : undefined} />
            </div>
          ))}
          {allowEdit ? <div className="pt-6 relative">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-gray-300"></div>
             <AddButton onClick={() => handleAdd('CHILD')} label="Add Child" />
          </div> : null}
        </div>
      </div>
        </div>
      </div>
      
      {showAddModal && addRelationType && (
          <AddPersonModal 
            relationToId={currentPersonId} 
            relationType={addRelationType} 
            onClose={() => setShowAddModal(false)}
            onSuccess={handlePersonAdded}
          />
      )}
      
      {showEditModal && editingPerson && (
          <EditPersonModal
            person={editingPerson}
            onClose={() => { setShowEditModal(false); setEditingPerson(null); }}
            onSuccess={handlePersonUpdated}
          />
      )}
      
      {showInviteModal && allowManage && (
          <InviteModal
            personId={currentPersonId}
            personName={`${person.firstName} ${person.lastName || ''}`}
            onClose={() => setShowInviteModal(false)}
          />
      )}

      {showDivorceModal && selectedSpouse && (
          <DivorceModal
            personId={currentPersonId}
            spouse={selectedSpouse}
            onClose={() => setShowDivorceModal(false)}
            onSuccess={handleDivorceSuccess}
          />
      )}

      {showAssociateChildModal && associationSpouse ? (
          <AssociateChildModal
            personId={currentPersonId}
            spouse={associationSpouse}
            availableChildren={children}
            onClose={() => { setShowAssociateChildModal(false); setAssociationSpouse(null); }}
            onSuccess={handleAssociateChildSuccess}
          />
      ) : null}
    </div>
  );
}

function PersonCard({ person, onClick, onEdit, compact, displayNameMode = 'default', aliasRoles = [] }: { person: PersonLike, onClick: () => void, onEdit?: () => void, compact?: boolean, displayNameMode?: 'default' | 'nicknameOrFull', aliasRoles?: string[] }) {
    const deceased = isPersonDeceased(person)
    const primaryName = getPersonCardDisplayName(person, displayNameMode)
    const showSeparateLastName = !compact && displayNameMode === 'default'

    return (
        <div 
            onClick={onClick}
            className={`
                group cursor-pointer border rounded-xl transition-all duration-200 
                flex flex-col items-center shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 relative
                ${compact ? 'p-2 w-20 sm:w-24' : 'p-3 w-28 sm:p-4 sm:w-36'} 
                ${deceased ? 'bg-slate-50 border-slate-200' : 'bg-white border-gray-200'}
                ${person.isDivorced ? 'opacity-70 border-dashed' : ''}
            `}
        >
            {onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="absolute top-1 right-1 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Edit"
                >
                    <Edit2 size={12} />
                </button>
            )}
            <div className={`
                rounded-full flex items-center justify-center 
                ${compact ? 'w-10 h-10' : 'w-16 h-16'} 
                mb-3 overflow-hidden relative border-2 border-white shadow-inner
                ${deceased ? 'bg-slate-200' : 'bg-gray-100'}
            `}>
                {getPrimaryPhotoUrl(person) ? (
                    <img src={getPrimaryPhotoUrl(person) ?? undefined} alt={person.firstName} className={`w-full h-full object-cover ${deceased ? 'grayscale' : ''}`} />
                ) : (
                    <UserIcon size={compact ? 20 : 28} className={deceased ? 'text-slate-500' : 'text-gray-400'} />
                )}
                {person.isDivorced && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-400 rotate-45 absolute"></div>
                    </div>
                )}
            </div>
            
            <div className={`font-serif font-bold text-center w-full ${compact ? 'text-xs' : 'text-sm'} ${deceased ? 'text-slate-800' : 'text-gray-800'}`}>
                <span className="block truncate">{primaryName}</span>
            </div>
            {showSeparateLastName ? <div className="text-xs text-gray-500 truncate w-full text-center mt-0.5">{person.lastName}</div> : null}
            {getLatestPositionLabel(person) ? (
                <div className="mt-1 w-full truncate text-center text-[11px] text-slate-500">
                    {getLatestPositionLabel(person)}
                </div>
            ) : null}
            {aliasRoles.length > 0 ? (
                <div className="mt-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Also: {aliasRoles.join(', ')}
                </div>
            ) : null}
            {deceased ? (
                <div className="mt-2 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    In memory
                </div>
            ) : null}
            <ReviewBadge person={person} compact={compact} />
            <Link
                href={`/dashboard/person/${person.id}`}
                onClick={(event) => event.stopPropagation()}
                className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 hover:underline"
            >
                Explore
            </Link>
            
            {person.isDivorced && <div className="text-[10px] text-red-400 font-bold uppercase mt-2 tracking-wide">Divorced</div>}
        </div>
    );
}

function ReviewBadge({ person, compact }: { person: PersonLike; compact?: boolean }) {
    if (!person.reviewState?.needsReview && !person.reviewState?.openLinkCount) return null

    if (person.reviewState?.status === 'needs_review') {
        return (
            <div className={`mt-2 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ${compact ? '' : ''}`}>
                Needs review
            </div>
        )
    }

    return (
        <div className="mt-2 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Linked
        </div>
    )
}

function AddButton({ onClick, label, small }: { onClick: () => void, label: string, small?: boolean }) {
    return (
        <button 
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl 
                hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-400 hover:text-indigo-500 transition-all
                ${small ? 'w-12 h-12 rounded-full' : 'w-36 h-36'}
            `}
            title={label}
        >
            <Plus size={small ? 20 : 32} />
            {!small && <span className="text-xs mt-2 font-medium">{label}</span>}
        </button>
    );
}
