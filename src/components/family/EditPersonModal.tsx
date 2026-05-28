'use client';

import { useState } from 'react';
import { deletePerson, updatePerson } from '@/actions/family';
import { Loader2, Upload, X } from 'lucide-react';
import { normalizeLifeStatus, type LifeStatus } from '@/lib/lifeStatus';
import {
  normalizeEducationHistory,
  normalizeProfessionalHistory,
  type EducationHistoryEntry,
  type ProfessionalHistoryEntry,
} from '@/lib/personHistory';
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
    lifeStatus?: string | null;
    educationHistory?: unknown;
    professionalHistory?: unknown;
    dateOfBirth?: string | Date | null;
    placeOfBirth?: string | null;
    dateOfDeath?: string | Date | null;
    placeOfDeath?: string | null;
    updatedAt?: string | Date | null;
    photos?: Array<{
      id?: string;
      url: string;
      date?: string | Date | null;
    }>;
  };
  onClose: () => void;
  onSuccess: () => void;
  canDelete?: boolean;
  onDeleted?: (personId: string) => void;
}

const emptyEducationEntry = (): EducationHistoryEntry => ({
  institution: '',
  degree: '',
  fieldOfStudy: '',
  startYear: '',
  endYear: '',
  description: '',
})

const emptyProfessionalEntry = (): ProfessionalHistoryEntry => ({
  company: '',
  position: '',
  startYear: '',
  endYear: '',
  isCurrent: false,
  description: '',
})

const modalTabs = [
  { id: 'personal', label: 'Personal Info' },
  { id: 'education', label: 'Educational' },
  { id: 'professional', label: 'Professional' },
] as const

type ModalTabId = (typeof modalTabs)[number]['id']

const lifeStatusOptions: Array<{ value: LifeStatus; label: string; description: string }> = [
  { value: 'LIVING', label: 'Living', description: 'Use when the person is known to be living.' },
  { value: 'DECEASED', label: 'Deceased', description: 'Use even if the exact death date is not known.' },
  { value: 'UNKNOWN', label: 'Unknown', description: 'Use when the life status is uncertain or unconfirmed.' },
]

function normalizePhotoUrl(value: string) {
  const cleaned = value.trim().replaceAll('\\', '/')
  if (!cleaned) return null
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('data:')) return cleaned
  if (cleaned.startsWith('/')) return cleaned

  const uploadsIndex = cleaned.indexOf('/uploads/')
  if (uploadsIndex >= 0) return cleaned.slice(uploadsIndex)

  return `/${cleaned}`
}

export default function EditPersonModal({ person, onClose, onSuccess, canDelete, onDeleted }: EditPersonModalProps) {
  const initialEducationHistory = normalizeEducationHistory(person.educationHistory)
  const initialProfessionalHistory = normalizeProfessionalHistory(person.professionalHistory)
  const [activeTab, setActiveTab] = useState<ModalTabId>('personal')
  const [formData, setFormData] = useState({
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    middleName: person.middleName || '',
    nickName: person.nickName || '',
    title: person.title || '',
    gender: person.gender || 'UNKNOWN',
    lifeStatus: normalizeLifeStatus(person.lifeStatus),
    dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth).toISOString().split('T')[0] : '',
    placeOfBirth: person.placeOfBirth || '',
    dateOfDeath: person.dateOfDeath ? new Date(person.dateOfDeath).toISOString().split('T')[0] : '',
    placeOfDeath: person.placeOfDeath || '',
    photoUrl: '',
    photoDate: '',
    educationHistory: initialEducationHistory.length > 0 ? initialEducationHistory : [emptyEducationEntry()],
    professionalHistory: initialProfessionalHistory.length > 0 ? initialProfessionalHistory : [emptyProfessionalEntry()],
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [replacePhoto, setReplacePhoto] = useState(true);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const showDeathDetails = formData.lifeStatus === 'DECEASED'

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
        dateOfDeath: showDeathDetails ? (formData.dateOfDeath ? new Date(formData.dateOfDeath) : null) : null,
        placeOfDeath: showDeathDetails ? (formData.placeOfDeath.trim() || null) : null,
        photoUrl: formData.photoUrl || undefined,
        photoDate: formData.photoDate ? new Date(formData.photoDate) : undefined,
        replacePhoto,
        removePhoto,
        lastKnownUpdatedAt: person.updatedAt ? new Date(person.updatedAt) : undefined,
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

  const updateEducationEntry = (index: number, field: keyof EducationHistoryEntry, value: string) => {
    setFormData((current) => ({
      ...current,
      educationHistory: current.educationHistory.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      ),
    }))
  }

  const updateProfessionalEntry = (
    index: number,
    field: keyof ProfessionalHistoryEntry,
    value: string | boolean
  ) => {
    setFormData((current) => ({
      ...current,
      professionalHistory: current.professionalHistory.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      ),
    }))
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    setError('')
    try {
      const result = await deletePerson(person.id)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        setDeleteError(String(result.error))
        return
      }
      onDeleted?.(person.id)
      onClose()
    } catch {
      setDeleteError('Failed to delete person.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-lg">Edit Details: {person.firstName}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {modalTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-500 p-2 rounded text-sm">{error}</div>}
          
          {activeTab === 'personal' ? (
            <>
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

              <div>
                <label className="block text-sm font-medium mb-2">Life Status</label>
                <div className="grid gap-3 md:grid-cols-3">
                  {lifeStatusOptions.map((option) => {
                    const active = formData.lifeStatus === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            lifeStatus: option.value,
                            dateOfDeath: option.value === 'DECEASED' ? current.dateOfDeath : '',
                            placeOfDeath: option.value === 'DECEASED' ? current.placeOfDeath : '',
                          }))
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs text-current/80">{option.description}</div>
                      </button>
                    )
                  })}
                </div>
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

              {showDeathDetails ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-slate-900">Death details</div>
                    <div className="mt-1 text-xs text-slate-500">You can leave the death date blank if the person is known to be deceased but the exact date is unknown.</div>
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
                </div>
              ) : formData.lifeStatus === 'UNKNOWN' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Life status is marked as unknown. The person will not be shown as living or deceased until this is clarified.
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Living is selected. Any previously entered death details will be cleared when you save.
                </div>
              )}
              
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

              {canDelete ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-900">Delete person</div>
                  <div className="mt-1 text-xs text-rose-800">This removes the person and unlinks them from families. This cannot be undone.</div>
                  <div className="mt-3 grid gap-2">
                    <input
                      className="w-full rounded border border-rose-200 bg-white px-3 py-2 text-sm"
                      placeholder='Type DELETE to confirm'
                      value={deleteConfirm}
                      onChange={(event) => setDeleteConfirm(event.target.value)}
                    />
                    {deleteError ? <div className="rounded bg-white/70 px-3 py-2 text-sm text-rose-700">{deleteError}</div> : null}
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteLoading || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
                      className="w-full rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete person'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'education' ? (
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium mb-1">Education history</label>
                <p className="text-xs text-gray-500">Track schools, degrees, and study periods.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, educationHistory: [...current.educationHistory, emptyEducationEntry()] }))}
                className="rounded border px-3 py-2 text-xs font-medium hover:bg-gray-50"
              >
                Add education
              </button>
            </div>
            {formData.educationHistory.map((entry, index) => (
              <div key={`education-${index}`} className="space-y-3 rounded border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Entry {index + 1}</div>
                  {formData.educationHistory.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, educationHistory: current.educationHistory.filter((_, entryIndex) => entryIndex !== index) }))}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full border rounded px-3 py-2" placeholder="Institution" value={entry.institution} onChange={e => updateEducationEntry(index, 'institution', e.target.value)} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Degree" value={entry.degree} onChange={e => updateEducationEntry(index, 'degree', e.target.value)} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Field of study" value={entry.fieldOfStudy} onChange={e => updateEducationEntry(index, 'fieldOfStudy', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="w-full border rounded px-3 py-2" placeholder="Start year" value={entry.startYear} onChange={e => updateEducationEntry(index, 'startYear', e.target.value)} />
                    <input className="w-full border rounded px-3 py-2" placeholder="End year" value={entry.endYear} onChange={e => updateEducationEntry(index, 'endYear', e.target.value)} />
                  </div>
                </div>
                <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Notes" value={entry.description} onChange={e => updateEducationEntry(index, 'description', e.target.value)} />
              </div>
            ))}
            </div>
          ) : null}

          {activeTab === 'professional' ? (
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium mb-1">Professional history</label>
                <p className="text-xs text-gray-500">Track roles, employers, and the current or latest position.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, professionalHistory: [...current.professionalHistory, emptyProfessionalEntry()] }))}
                className="rounded border px-3 py-2 text-xs font-medium hover:bg-gray-50"
              >
                Add role
              </button>
            </div>
            {formData.professionalHistory.map((entry, index) => (
              <div key={`professional-${index}`} className="space-y-3 rounded border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role {index + 1}</div>
                  {formData.professionalHistory.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, professionalHistory: current.professionalHistory.filter((_, entryIndex) => entryIndex !== index) }))}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full border rounded px-3 py-2" placeholder="Company / organization" value={entry.company} onChange={e => updateProfessionalEntry(index, 'company', e.target.value)} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Position" value={entry.position} onChange={e => updateProfessionalEntry(index, 'position', e.target.value)} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Start year" value={entry.startYear} onChange={e => updateProfessionalEntry(index, 'startYear', e.target.value)} />
                  <input className="w-full border rounded px-3 py-2" placeholder="End year" value={entry.endYear} onChange={e => updateProfessionalEntry(index, 'endYear', e.target.value)} disabled={entry.isCurrent} />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={entry.isCurrent} onChange={e => updateProfessionalEntry(index, 'isCurrent', e.target.checked)} className="h-4 w-4" />
                  This is the current position
                </label>
                <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Notes" value={entry.description} onChange={e => updateProfessionalEntry(index, 'description', e.target.value)} />
              </div>
            ))}
            </div>
          ) : null}
          </div>

          <div className="border-t px-4 py-4">
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}
