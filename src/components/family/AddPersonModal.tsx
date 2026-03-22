'use client';

import { useState } from 'react';
import { addPerson } from '@/actions/family';
import { X } from 'lucide-react';

export default function AddPersonModal({ relationToId, relationType, onClose, onSuccess }: { relationToId: string, relationType: 'PARENT' | 'CHILD' | 'SPOUSE', onClose: () => void, onSuccess: () => void }) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
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
                    <label className="block text-sm font-medium mb-1">Marriage Date</label>
                    <input 
                        type="date"
                        className="w-full border rounded px-3 py-2"
                        value={formData.marriageDate}
                        onChange={e => setFormData({...formData, marriageDate: e.target.value})}
                    />
                </div>
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
                    {loading ? 'Adding...' : 'Add Person'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
