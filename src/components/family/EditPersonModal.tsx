'use client';

import { useState } from 'react';
import { updatePerson } from '@/actions/family';
import { Loader2, Upload, X } from 'lucide-react';
import { validateImageUpload } from '@/lib/upload';

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
    photos?: Array<{
      id?: string;
      url: string;
      date?: string | Date | null;
    }>;
  };
  onClose: () => void;
  onSuccess: () => void;
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [replacePhoto, setReplacePhoto] = useState(true);
  const [removePhoto, setRemovePhoto] = useState(false);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setError('');

    try {
      const validation = validateImageUpload({ mimeType: file.type, size: file.size })
      if (!validation.valid) {
        setError(validation.error)
        return
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('personId', person.id);
      uploadFormData.append('replace', replacePhoto ? 'true' : 'false');
      if (formData.photoDate) {
        uploadFormData.append('photoDate', formData.photoDate);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response
        .json()
        .catch(async () => ({ error: await response.text().catch(() => 'Upload failed') }))

      if (!response.ok) {
        setError(result.error ?? `Failed to upload photo (HTTP ${response.status})`);
        return;
      }

      setFormData((current) => ({
        ...current,
        photoUrl: result.url,
      }));
      setReplacePhoto(true);
      setRemovePhoto(false);
    } catch {
      setError('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

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
        photoDate: formData.photoDate ? new Date(formData.photoDate) : undefined,
        replacePhoto,
        removePhoto
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
              <label className="block text-sm font-medium mb-1">Add Photo</label>
              <div className="space-y-3">
                {person.photos?.[0]?.url ? (
                  <div className="rounded border bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current photo</div>
                    <div className="mt-2 flex items-center gap-3">
                      <img src={(person.photos?.[0]?.id ? `/api/photo/${person.photos[0].id}` : normalizePhotoUrl(person.photos[0].url)) ?? undefined} alt="Current" className="h-16 w-16 rounded object-cover border" />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRemovePhoto(true)
                            setFormData((current) => ({ ...current, photoUrl: '', photoDate: '' }))
                          }}
                          className="w-fit rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Remove current photo
                        </button>
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={replacePhoto}
                            onChange={(event) => setReplacePhoto(event.target.checked)}
                            className="h-4 w-4"
                          />
                          Replace existing photo on save
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                  {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span>{uploadingPhoto ? 'Uploading photo...' : 'Upload image from device'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>

                {formData.photoUrl ? (
                  <div className="rounded border bg-gray-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">New photo preview</div>
                    <img src={normalizePhotoUrl(formData.photoUrl) ?? undefined} alt="Uploaded preview" className="h-28 w-28 rounded object-cover border" />
                    <p className="mt-2 break-all text-xs text-gray-500">{formData.photoUrl}</p>
                  </div>
                ) : null}

                <div className="flex gap-2">
                <input
                  className="w-full border rounded px-3 py-2 flex-grow"
                  value={formData.photoUrl}
                  onChange={e => {
                    setFormData({...formData, photoUrl: e.target.value})
                    setRemovePhoto(false)
                  }}
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
              </div>
              <p className="text-xs text-gray-500 mt-1">Upload directly from your device or paste an image URL. Supported: JPG, PNG, WEBP, GIF up to 5MB.</p>
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
              disabled={loading || uploadingPhoto}
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
