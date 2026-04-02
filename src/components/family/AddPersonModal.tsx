'use client';

import { useState } from 'react';
import { addPerson, linkExistingPersonAsChild, linkExistingPersonAsParent, linkExistingPersonAsSpouse, searchPeopleForRelationship } from '@/actions/family';
import { X } from 'lucide-react';

function getLinkModeDescription(relationType: 'PARENT' | 'CHILD' | 'SPOUSE') {
  if (relationType === 'SPOUSE') {
    return 'Use this when the spouse already exists elsewhere in the family tree, such as a cousin or another relative.'
  }

  if (relationType === 'PARENT') {
    return 'Use this when the parent already exists elsewhere in the family tree and should be linked instead of created again.'
  }

  return 'Use this when the child already exists elsewhere in the family tree and should be linked instead of created again.'
}

export default function AddPersonModal({ relationToId, relationType, onClose, onSuccess }: { relationToId: string, relationType: 'PARENT' | 'CHILD' | 'SPOUSE', onClose: () => void, onSuccess: () => void }) {
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    placeOfBirth: '',
    marriageDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const [existingPeople, setExistingPeople] = useState<Array<{
    id: string
    firstName: string
    lastName: string | null
    nickName: string | null
    dateOfBirth: string | Date | null
    computedDistance: number | null
  }>>([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');

  const loadPeople = async () => {
    setLoadingPeople(true);
    setError(null);

    try {
      const result = await searchPeopleForRelationship(personQuery, relationToId);
      if (result.error) {
        setError(result.error);
        setExistingPeople([]);
        return;
      }

      setExistingPeople(result.people);
      setSelectedPersonId(result.people[0]?.id ?? '');
    } catch {
      setError('Failed to load people');
      setExistingPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
        if (mode === 'link') {
            if (!selectedPersonId) {
                setError('Please select an existing person to link.');
                return;
            }

            const result =
                relationType === 'SPOUSE'
                    ? await linkExistingPersonAsSpouse(
                        relationToId,
                        selectedPersonId,
                        formData.marriageDate ? new Date(formData.marriageDate) : undefined
                    )
                    : relationType === 'PARENT'
                        ? await linkExistingPersonAsParent(relationToId, selectedPersonId)
                        : await linkExistingPersonAsChild(relationToId, selectedPersonId)

            if ('error' in result) {
                setError(result.error);
            } else {
                onSuccess();
            }
            return;
        }

        const payload = {
            ...formData,
            dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
            marriageDate: formData.marriageDate ? new Date(formData.marriageDate) : undefined
        };
        
        const result = await addPerson(payload, relationToId, relationType);
        if (result.error) {
            setError(result.error);
        } else {
            onSuccess();
        }
    } catch {
        setError("Failed to add person");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold text-lg">Add {relationType.toLowerCase()}</h3>
            <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-gray-50 p-1">
                <button
                    type="button"
                    onClick={() => setMode('create')}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}
                >
                    Create New
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode('link')
                        if (existingPeople.length === 0) {
                            void loadPeople()
                        }
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'link' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}
                >
                    Link Existing
                </button>
            </div>

            {mode === 'link' ? (
                <>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                        {getLinkModeDescription(relationType)}
                    </div>

                    <div className="flex gap-2">
                        <input
                            className="w-full border rounded px-3 py-2"
                            value={personQuery}
                            onChange={e => setPersonQuery(e.target.value)}
                            placeholder="Search by name or nickname"
                        />
                        <button
                            type="button"
                            onClick={loadPeople}
                            disabled={loadingPeople}
                            className="px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            {loadingPeople ? '...' : 'Search'}
                        </button>
                    </div>

                    <div className="max-h-56 overflow-auto rounded border">
                        {existingPeople.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500">No matching people found</div>
                        ) : (
                            <ul className="divide-y">
                                {existingPeople.map((person) => (
                                    <li key={person.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPersonId(person.id)}
                                            className={`w-full p-3 text-left hover:bg-gray-50 ${selectedPersonId === person.id ? 'bg-indigo-50' : ''}`}
                                        >
                                            <div className="text-sm font-medium text-gray-900">
                                                {person.firstName} {person.lastName ?? ''}
                                                {person.nickName ? <span className="ml-2 text-xs italic text-gray-500">“{person.nickName}”</span> : null}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {person.dateOfBirth ? `Born ${new Date(person.dateOfBirth).getFullYear()}` : 'Birth year unknown'}
                                                {typeof person.computedDistance === 'number' ? ` • Distance ${person.computedDistance}` : ''}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {relationType === 'SPOUSE' ? (
                        <div>
                            <label className="block text-sm font-medium mb-1">Marriage Date (Optional)</label>
                            <input 
                                type="date"
                                className="w-full border rounded px-3 py-2"
                                value={formData.marriageDate}
                                onChange={e => setFormData({...formData, marriageDate: e.target.value})}
                            />
                        </div>
                    ) : null}
                </>
            ) : (
                <>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input 
                        className="w-full border rounded px-3 py-2"
                        value={formData.firstName}
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input 
                        className="w-full border rounded px-3 py-2"
                        value={formData.lastName}
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                    />
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select 
                    className="w-full border rounded px-3 py-2"
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                >
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                </select>
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input 
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-1">Place of Birth</label>
                <input 
                    className="w-full border rounded px-3 py-2"
                    value={formData.placeOfBirth}
                    onChange={e => setFormData({...formData, placeOfBirth: e.target.value})}
                />
            </div>

            {relationType === 'SPOUSE' && (
                <div>
                    <label className="block text-sm font-medium mb-1">Marriage Date (Optional)</label>
                    <input 
                        type="date"
                        className="w-full border rounded px-3 py-2"
                        value={formData.marriageDate}
                        onChange={e => setFormData({...formData, marriageDate: e.target.value})}
                    />
                    <p className="mt-1 text-xs text-gray-500">You can edit marriage and divorce details later from the spouse relationship card.</p>
                </div>
            )}
                </>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
                <button 
                    type="button" 
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading
                        ? (mode === 'link' ? 'Linking...' : 'Adding...')
                        : (mode === 'link' ? `Link ${relationType.toLowerCase()}` : 'Add Person')}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
