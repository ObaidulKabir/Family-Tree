'use client';

import { useState } from 'react';
import { updatePerson } from '@/actions/family';
import { X } from 'lucide-react';

interface EditPersonModalProps {
  person: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    nickName?: string | null;
    title?: string | null;
    gender?: string | null;
    dateOfBirth?: string | Date | null;
    placeOfBirth?: string | null;
    dateOfDeath?: string | Date | null;
    placeOfDeath?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPersonModal({ person, onClose, onSuccess }: EditPersonModalProps) {
  const [formData, setFormData] = useState({
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    middleName: person.middleName || '',
    nickName: person.nickName || '',
    title: person.title || '',
    gender: person.gender || 'UNKNOWN',
    dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth).toISOString().split('T')[0] : '',
    placeOfBirth: person.placeOfBirth || '',
    dateOfDeath: person.dateOfDeath ? new Date(person.dateOfDeath).toISOString().split('T')[0] : '',
    placeOfDeath: person.placeOfDeath || '',
    photoUrl: '',
    photoDate: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
        dateOfDeath: formData.dateOfDeath ? new Date(formData.dateOfDeath) : undefined,
        photoUrl: formData.photoUrl || undefined,
        photoDate: formData.photoDate ? new Date(formData.photoDate) : undefined
      };
      
      const result = await updatePerson(person.id, data);
      
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-lg">Edit Details: {person.firstName}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-500 p-2 rounded text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                required
                className="w-full border rounded px-3 py-2"
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Middle Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={formData.middleName}
                onChange={e => setFormData({...formData, middleName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nickname</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={formData.nickName}
                onChange={e => setFormData({...formData, nickName: e.target.value})}
              />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium mb-1">Title (e.g. Dr., Sir)</label>
             <input
               className="w-full border rounded px-3 py-2"
               value={formData.title}
               onChange={e => setFormData({...formData, title: e.target.value})}
             />
          </div>

          <div>
             <label className="block text-sm font-medium mb-1">Gender</label>
             <select
                className="w-full border rounded px-3 py-2"
                value={formData.gender}
                onChange={e => setFormData({...formData, gender: e.target.value})}
             >
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
             </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date of Death</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={formData.dateOfDeath}
                onChange={e => setFormData({...formData, dateOfDeath: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Place of Death</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={formData.placeOfDeath}
                onChange={e => setFormData({...formData, placeOfDeath: e.target.value})}
              />
            </div>
          </div>
          
          <div>
              <label className="block text-sm font-medium mb-1">Add Photo (URL)</label>
              <div className="flex gap-2">
                <input
                  className="w-full border rounded px-3 py-2 flex-grow"
                  value={formData.photoUrl}
                  onChange={e => setFormData({...formData, photoUrl: e.target.value})}
                  placeholder="https://example.com/photo.jpg"
                />
                <input
                    type="date"
                    className="border rounded px-3 py-2 w-40"
                    value={formData.photoDate}
                    onChange={e => setFormData({...formData, photoDate: e.target.value})}
                    title="Photo Date"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Provide a direct link to an image and optional date.</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
