'use client';

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
  dateOfDeath?: DateLike;
  photos?: PhotoLike[];
  isDivorced?: boolean;
};

type FamilyTreeData = {
  error?: string;
  person: PersonLike;
  parents: PersonLike[];
  spouses: PersonLike[];
  children: PersonLike[];
  siblings: PersonLike[];
};

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

  return (
    <div className="flex flex-col items-center gap-12 min-h-[600px] py-10">
      
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
            <div className="flex items-center gap-6 p-6 bg-white rounded-2xl shadow-xl border border-indigo-50 ring-4 ring-indigo-50/50">
                
                {/* Focal Person */}
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-3 overflow-hidden border-4 border-white shadow-md relative group">
                        {person.photos && person.photos.length > 0 ? (
                            <>
                                <img src={person.photos[0].url} alt={person.firstName} className="w-full h-full object-cover" />
                                {person.photos[0].date && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1">
                                        {new Date(person.photos[0].date).getFullYear()}
                                    </div>
                                )}
                            </>
                        ) : (
                            <UserIcon size={40} className="text-indigo-400" />
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(person); }}
                            className="absolute top-1 right-1 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit"
                        >
                            <Edit2 size={16} />
                        </button>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-gray-800">{person.firstName} {person.lastName}</h2>
                    <p className="text-sm text-indigo-600 font-medium mb-1">{person.title || ''}</p>
                    {person.nickName && <p className="text-xs text-gray-500 italic">&quot;{person.nickName}&quot;</p>}
                    
                    <div className="text-xs text-gray-400 mt-2 flex flex-col items-center gap-0.5">
                        <span>{person.dateOfBirth ? `Born: ${new Date(person.dateOfBirth).toLocaleDateString()}` : 'No DOB'}</span>
                        {person.dateOfDeath && <span className="text-gray-500">Died: {new Date(person.dateOfDeath).toLocaleDateString()}</span>}
                    </div>
                    
                    <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={() => handleEdit(person)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Edit Details"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => setShowInviteModal(true)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Invite User"
                        >
                            <Share2 size={16} />
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
                                    <div className="mb-2 text-xs text-red-300"><Heart size={16} fill="currentColor" /></div>
                                    <PersonCard person={s} onClick={() => setCurrentPersonId(s.id)} onEdit={() => handleEdit(s)} />
                                    {!s.isDivorced && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDivorce(s); }}
                                            className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 shadow-sm transition-all"
                                            title="Record Divorce"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
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
    return (
        <div 
            onClick={onClick}
            className={`
                group cursor-pointer bg-white border border-gray-200 rounded-xl transition-all duration-200 
                flex flex-col items-center shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 relative
                ${compact ? 'p-2 w-24' : 'p-4 w-36'} 
                ${person.isDivorced ? 'opacity-70 border-dashed bg-gray-50' : ''}
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
                rounded-full bg-gray-100 flex items-center justify-center 
                ${compact ? 'w-10 h-10' : 'w-16 h-16'} 
                mb-3 overflow-hidden relative border-2 border-white shadow-inner
            `}>
                {person.photos && person.photos.length > 0 ? (
                    <img src={person.photos[0].url} alt={person.firstName} className="w-full h-full object-cover" />
                ) : (
                    <UserIcon size={compact ? 20 : 28} className="text-gray-400" />
                )}
                {person.isDivorced && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-400 rotate-45 absolute"></div>
                    </div>
                )}
            </div>
            
            <div className={`font-serif font-bold text-gray-800 text-center truncate w-full ${compact ? 'text-xs' : 'text-sm'}`}>
                {person.firstName}
            </div>
            {!compact && <div className="text-xs text-gray-500 truncate w-full text-center mt-0.5">{person.lastName}</div>}
            
            {person.isDivorced && <div className="text-[10px] text-red-400 font-bold uppercase mt-2 tracking-wide">Divorced</div>}
        </div>
    );
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
