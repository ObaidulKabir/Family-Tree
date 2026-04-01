'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getPersonDetails } from '@/actions/family';
import { User as UserIcon, Heart, Plus, Share2, Edit2, X } from 'lucide-react';
import AddPersonModal from './AddPersonModal';
import InviteModal from './InviteModal';
import EditPersonModal from './EditPersonModal';
import DivorceModal from './DivorceModal';

type DateLike = string | Date | null | undefined;

type PhotoLike = {
  url: string;
  date?: DateLike;
};

type PersonLike = {
  id: string;
  firstName: string;
  lastName?: string | null;
  title?: string | null;
  nickName?: string | null;
  dateOfBirth?: DateLike;
  placeOfBirth?: string | null;
  dateOfDeath?: DateLike;
  placeOfDeath?: string | null;
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

function getRelationshipSummary(person: PersonLike) {
  if (person.isDivorced) {
    return `Divorced${person.divorceDate ? ` • ${formatDisplayDate(person.divorceDate)}` : ''}`;
  }
  return `Married${person.marriageDate ? ` • ${formatDisplayDate(person.marriageDate)}` : ''}`;
}

export default function FamilyTreeView({ initialPersonId }: { initialPersonId: string }) {
  const [currentPersonId, setCurrentPersonId] = useState(initialPersonId);
  const [data, setData] = useState<FamilyTreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDivorceModal, setShowDivorceModal] = useState(false);
  const [selectedSpouse, setSelectedSpouse] = useState<PersonLike | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonLike | null>(null);
  const [addRelationType, setAddRelationType] = useState<'PARENT' | 'CHILD' | 'SPOUSE' | null>(null);

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
  
  const handleAdd = (type: 'PARENT' | 'CHILD' | 'SPOUSE') => {
      setAddRelationType(type);
      setShowAddModal(true);
  };
  
  const handlePersonAdded = () => {
      setShowAddModal(false);
      loadPerson(currentPersonId);
  };

  const handleEdit = (p: PersonLike) => {
      setEditingPerson(p);
      setShowEditModal(true);
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

  if (loading) return <div className="flex h-96 items-center justify-center text-gray-400">Loading family data...</div>;
  if (!data) return <div className="flex h-96 items-center justify-center text-red-400">Person not found</div>;

  const { person, parents, spouses, children, siblings } = data;
  const reviewSummary = data.reviewSummary;

  return (
    <div className="flex flex-col items-center gap-12 min-h-[600px] py-10">
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
      
      {/* --- Generation 1: Parents --- */}
      <div className="flex flex-col items-center relative">
        <h3 className="absolute -top-8 text-xs font-bold text-gray-400 tracking-wider uppercase">Parents</h3>
        <div className="flex gap-8 items-end">
          {parents.length > 0 ? (
            <div className="flex gap-4 p-4 bg-white/50 rounded-xl border border-gray-100 shadow-sm">
              {parents.map((p: PersonLike) => (
                <PersonCard key={p.id} person={p} onClick={() => setCurrentPersonId(p.id)} onEdit={() => handleEdit(p)} />
              ))}
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl">
               <span className="text-xs text-gray-400">No parents recorded</span>
            </div>
          )}
          {parents.length < 2 && (
             <AddButton onClick={() => handleAdd('PARENT')} label="Add Parent" small />
          )}
        </div>
        {/* Connector Line Down */}
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
                        <PersonCard key={s.id} person={s} compact onClick={() => setCurrentPersonId(s.id)} onEdit={() => handleEdit(s)} />
                    ))}
                </div>
            </div>
        )}
      
        {/* Main Focus Group */}
        <div className="flex flex-col items-center relative z-10">
            <div className={`flex items-center gap-6 p-6 rounded-2xl shadow-xl border ring-4 ${isPersonDeceased(person) ? 'bg-slate-50 border-slate-200 ring-slate-100' : 'bg-white border-indigo-50 ring-indigo-50/50'}`}>
                
                {/* Focal Person */}
                <div className="flex flex-col items-center group">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden border-4 shadow-md relative group ${isPersonDeceased(person) ? 'bg-slate-200 border-slate-100' : 'bg-indigo-100 border-white'}`}>
                        {person.photos && person.photos.length > 0 ? (
                            <>
                                <img src={person.photos[0].url} alt={person.firstName} className={`w-full h-full object-cover ${isPersonDeceased(person) ? 'grayscale' : ''}`} />
                                {person.photos[0].date && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1">
                                        {new Date(person.photos[0].date).getFullYear()}
                                    </div>
                                )}
                            </>
                        ) : (
                            <UserIcon size={40} className={isPersonDeceased(person) ? 'text-slate-500' : 'text-indigo-400'} />
                        )}
                    </div>
                    <h2 className={`text-2xl font-serif font-bold ${isPersonDeceased(person) ? 'text-slate-800' : 'text-gray-800'}`}>{person.firstName} {person.lastName}</h2>
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
                        <button 
                            onClick={() => handleEdit(person)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Edit Details"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => setShowInviteModal(true)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Invite to claim"
                        >
                            <Share2 size={16} />
                            <span className="text-xs font-medium">Invite to claim</span>
                        </button>
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
                                        onClick={(e) => { e.stopPropagation(); handleDivorce(s); }}
                                        className="mb-2 flex flex-col items-center text-xs text-red-300 hover:text-red-400"
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
                                    <PersonCard person={s} onClick={() => setCurrentPersonId(s.id)} onEdit={() => handleEdit(s)} />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDivorce(s); }}
                                        className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 shadow-sm transition-all"
                                        title={s.isDivorced ? 'Edit relationship' : 'Record divorce'}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                
                <div className="ml-2">
                    <AddButton onClick={() => handleAdd('SPOUSE')} label="Add Spouse" small />
                </div>
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
                <PersonCard person={c} onClick={() => setCurrentPersonId(c.id)} onEdit={() => handleEdit(c)} />
            </div>
          ))}
          <div className="pt-6 relative">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-gray-300"></div>
             <AddButton onClick={() => handleAdd('CHILD')} label="Add Child" />
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
      
      {showInviteModal && (
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
    </div>
  );
}

function PersonCard({ person, onClick, onEdit, compact }: { person: PersonLike, onClick: () => void, onEdit?: () => void, compact?: boolean }) {
    const deceased = isPersonDeceased(person)

    return (
        <div 
            onClick={onClick}
            className={`
                group cursor-pointer border rounded-xl transition-all duration-200 
                flex flex-col items-center shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 relative
                ${compact ? 'p-2 w-24' : 'p-4 w-36'} 
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
                {person.photos && person.photos.length > 0 ? (
                    <img src={person.photos[0].url} alt={person.firstName} className={`w-full h-full object-cover ${deceased ? 'grayscale' : ''}`} />
                ) : (
                    <UserIcon size={compact ? 20 : 28} className={deceased ? 'text-slate-500' : 'text-gray-400'} />
                )}
                {person.isDivorced && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-400 rotate-45 absolute"></div>
                    </div>
                )}
            </div>
            
            <div className={`font-serif font-bold text-center truncate w-full ${compact ? 'text-xs' : 'text-sm'} ${deceased ? 'text-slate-800' : 'text-gray-800'}`}>
                {person.firstName}
            </div>
            {!compact && <div className="text-xs text-gray-500 truncate w-full text-center mt-0.5">{person.lastName}</div>}
            {deceased ? (
                <div className="mt-2 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    In memory
                </div>
            ) : null}
            <ReviewBadge person={person} compact={compact} />
            
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
