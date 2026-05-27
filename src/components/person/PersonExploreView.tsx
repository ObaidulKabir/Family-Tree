'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { getLatestProfessionalPosition, normalizeEducationHistory, normalizeProfessionalHistory } from '@/lib/personHistory'
import {
  buildResidenceMapLink,
  deriveAgeLabel,
  normalizeLivingHistory,
  sortLivingHistory,
  type LivingHistoryEntry,
} from '@/lib/personExplore'

type ExplorePerson = {
  id: string
  firstName: string
  lastName?: string | null
  title?: string | null
  dateOfBirth?: string | Date | null
  placeOfBirth?: string | null
  dateOfDeath?: string | Date | null
  placeOfDeath?: string | null
  educationHistory?: unknown
  professionalHistory?: unknown
  livingHistory?: unknown
}

type ExplorePhoto = {
  id: string
  date?: string | Date | null
  caption?: string | null
  albumCategory?: string | null
  ageLabel?: string | null
  locationLabel?: string | null
  isGroupPhoto?: boolean | null
  peopleTags?: unknown
  createdAt?: string | Date
}

type ExplorePermission = {
  canEdit: boolean
  role: string
}

const exploreTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'living', label: 'Living History' },
  { id: 'life', label: 'Life History' },
] as const

type ExploreTab = (typeof exploreTabs)[number]['id']

const emptyResidence = (): LivingHistoryEntry => ({
  placeName: '',
  address: '',
  startDate: '',
  endDate: '',
  notes: '',
  latitude: '',
  longitude: '',
})

function formatDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}

export default function PersonExploreView({
  person,
  photos: initialPhotos,
  permission,
}: {
  person: ExplorePerson
  photos: ExplorePhoto[]
  permission: ExplorePermission
}) {
  const [activeTab, setActiveTab] = useState<ExploreTab>('overview')
  const [livingHistory, setLivingHistory] = useState(() => {
    const normalized = normalizeLivingHistory(person.livingHistory)
    return normalized.length > 0 ? normalized : [emptyResidence()]
  })
  const [savingLiving, setSavingLiving] = useState(false)
  const [livingMessage, setLivingMessage] = useState('')
  const [livingQuery, setLivingQuery] = useState('')
  const [photos, setPhotos] = useState(initialPhotos)
  const [albumQuery, setAlbumQuery] = useState('')
  const [albumCategory, setAlbumCategory] = useState('ALL')
  const [albumMessage, setAlbumMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [albumForm, setAlbumForm] = useState({
    file: null as File | null,
    photoDate: '',
    locationLabel: '',
    caption: '',
    albumCategory: 'PORTRAIT',
    isGroupPhoto: false,
    peopleTags: '',
    ageLabel: '',
  })

  const educationHistory = normalizeEducationHistory(person.educationHistory)
  const professionalHistory = normalizeProfessionalHistory(person.professionalHistory)
  const latestPosition = getLatestProfessionalPosition(professionalHistory)

  const filteredLivingHistory = useMemo(() => {
    const normalizedQuery = livingQuery.trim().toLowerCase()
    return sortLivingHistory(livingHistory).filter((entry) => {
      if (!normalizedQuery) return true
      return [entry.placeName, entry.address, entry.notes].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [livingHistory, livingQuery])

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = albumQuery.trim().toLowerCase()
    return photos.filter((photo) => {
      if (albumCategory !== 'ALL' && (photo.albumCategory ?? 'PORTRAIT') !== albumCategory) {
        return false
      }

      if (!normalizedQuery) return true
      const tags = Array.isArray(photo.peopleTags) ? photo.peopleTags.join(' ') : ''
      return [photo.caption, photo.locationLabel, photo.ageLabel, tags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [photos, albumCategory, albumQuery])

  const updateResidence = (index: number, field: keyof LivingHistoryEntry, value: string) => {
    setLivingHistory((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry))
    )
  }

  const saveLivingHistory = async () => {
    setSavingLiving(true)
    setLivingMessage('')
    try {
      const response = await fetch(`/api/person/${person.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livingHistory }),
      })

      const result = await response.json()
      if (!response.ok) {
        setLivingMessage(result.error ?? 'Failed to save living history.')
        return
      }

      setLivingHistory(result.person.livingHistory)
      setLivingMessage('Living history saved.')
    } catch {
      setLivingMessage('Failed to save living history.')
    } finally {
      setSavingLiving(false)
    }
  }

  const uploadAlbumPhoto = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!albumForm.file) {
      setAlbumMessage('Choose an image first.')
      return
    }

    setUploading(true)
    setAlbumMessage('')

    try {
      const formData = new FormData()
      formData.set('file', albumForm.file)
      formData.set('photoDate', albumForm.photoDate)
      formData.set('locationLabel', albumForm.locationLabel)
      formData.set('caption', albumForm.caption)
      formData.set('albumCategory', albumForm.albumCategory)
      formData.set('isGroupPhoto', albumForm.isGroupPhoto ? 'true' : 'false')
      formData.set('peopleTags', albumForm.peopleTags)
      formData.set('ageLabel', albumForm.ageLabel)

      const response = await fetch(`/api/person/${person.id}/album`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) {
        setAlbumMessage(result.error ?? 'Failed to upload life-history photo.')
        return
      }

      setPhotos((current) => [result.photo, ...current])
      setAlbumMessage('Life-history photo uploaded.')
      setAlbumForm({
        file: null,
        photoDate: '',
        locationLabel: '',
        caption: '',
        albumCategory: 'PORTRAIT',
        isGroupPhoto: false,
        peopleTags: '',
        ageLabel: '',
      })
    } catch {
      setAlbumMessage('Failed to upload life-history photo.')
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (photoId: string) => {
    setAlbumMessage('')
    const response = await fetch(`/api/person/${person.id}/album/${photoId}`, {
      method: 'DELETE',
    })
    const result = await response.json()
    if (!response.ok) {
      setAlbumMessage(result.error ?? 'Failed to delete photo.')
      return
    }

    setPhotos((current) => current.filter((photo) => photo.id !== photoId))
    setAlbumMessage('Photo removed.')
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
            Back to dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-serif font-bold text-slate-900">
            {person.firstName} {person.lastName}
          </h1>
          {person.title ? <p className="mt-1 text-sm font-medium text-indigo-600">{person.title}</p> : null}
          {latestPosition ? (
            <p className="mt-1 text-sm text-slate-600">
              Latest role: {[latestPosition.position, latestPosition.company].filter(Boolean).join(' @ ')}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <div>Access role: {permission.role}</div>
          <div>{permission.canEdit ? 'Editing enabled' : 'Read-only access'}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{educationHistory.length}</div>
          <div className="text-xs text-slate-500">entries tracked</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Professional</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{professionalHistory.length}</div>
          <div className="text-xs text-slate-500">roles tracked</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Living History</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{normalizeLivingHistory(livingHistory).length}</div>
          <div className="text-xs text-slate-500">residences tracked</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Life History</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{photos.length}</div>
          <div className="text-xs text-slate-500">photos in album</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {exploreTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Educational timeline</h2>
            <div className="mt-4 space-y-4">
              {educationHistory.length > 0 ? educationHistory.map((entry, index) => (
                <div key={`edu-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-medium text-slate-900">{entry.institution || 'Institution not specified'}</div>
                  <div className="text-sm text-slate-600">{[entry.degree, entry.fieldOfStudy].filter(Boolean).join(', ') || 'No degree details'}</div>
                  <div className="mt-1 text-xs text-slate-500">{[entry.startYear, entry.endYear].filter(Boolean).join(' - ') || 'Dates not specified'}</div>
                  {entry.description ? <p className="mt-2 text-sm text-slate-600">{entry.description}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-500">No educational history recorded yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Professional timeline</h2>
            <div className="mt-4 space-y-4">
              {professionalHistory.length > 0 ? professionalHistory.map((entry, index) => (
                <div key={`job-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-medium text-slate-900">{entry.position || 'Position not specified'}</div>
                  <div className="text-sm text-slate-600">{entry.company || 'Organization not specified'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {entry.isCurrent ? 'Current role' : [entry.startYear, entry.endYear].filter(Boolean).join(' - ') || 'Dates not specified'}
                  </div>
                  {entry.description ? <p className="mt-2 text-sm text-slate-600">{entry.description}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-500">No professional history recorded yet.</p>}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'living' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Living history timeline</h2>
              <p className="mt-1 text-sm text-slate-500">Track where this person lived over time, with dates, notes, and map links.</p>
            </div>
            <input
              value={livingQuery}
              onChange={(event) => setLivingQuery(event.target.value)}
              placeholder="Filter residences"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {permission.canEdit ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLivingHistory((current) => [...current, emptyResidence()])}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Add residence
              </button>
              <button
                type="button"
                onClick={saveLivingHistory}
                disabled={savingLiving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingLiving ? 'Saving...' : 'Save living history'}
              </button>
            </div>
          ) : null}
          {livingMessage ? <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{livingMessage}</div> : null}

          <div className="mt-6 space-y-4">
            {filteredLivingHistory.map((entry, index) => (
              <div key={`living-${index}`} className="rounded-xl border border-slate-200 p-4">
                {permission.canEdit ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Place name" value={entry.placeName} onChange={(event) => updateResidence(index, 'placeName', event.target.value)} />
                    <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Address" value={entry.address} onChange={(event) => updateResidence(index, 'address', event.target.value)} />
                    <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={entry.startDate} onChange={(event) => updateResidence(index, 'startDate', event.target.value)} />
                    <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={entry.endDate} onChange={(event) => updateResidence(index, 'endDate', event.target.value)} />
                    <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Latitude" value={entry.latitude} onChange={(event) => updateResidence(index, 'latitude', event.target.value)} />
                    <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Longitude" value={entry.longitude} onChange={(event) => updateResidence(index, 'longitude', event.target.value)} />
                    <textarea className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="Notes or context" value={entry.notes} onChange={(event) => updateResidence(index, 'notes', event.target.value)} />
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-slate-900">{entry.placeName || 'Residence'}</div>
                    <div className="text-sm text-slate-600">{entry.address}</div>
                    <div className="mt-1 text-xs text-slate-500">{[entry.startDate, entry.endDate].filter(Boolean).join(' - ') || 'Dates not specified'}</div>
                    {entry.notes ? <p className="mt-2 text-sm text-slate-600">{entry.notes}</p> : null}
                  </div>
                )}
                {buildResidenceMapLink(entry) ? (
                  <div className="mt-3">
                    <a href={buildResidenceMapLink(entry) ?? '#'} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
                      Open map
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'life' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Life history album</h2>
              <p className="mt-1 text-sm text-slate-500">Organize portraits and group photos by life stage, place, and context.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={albumQuery}
                onChange={(event) => setAlbumQuery(event.target.value)}
                placeholder="Search photos"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={albumCategory}
                onChange={(event) => setAlbumCategory(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All categories</option>
                <option value="PORTRAIT">Portraits</option>
                <option value="GROUP">Group photos</option>
              </select>
            </div>
          </div>

          {permission.canEdit ? (
            <form onSubmit={uploadAlbumPhoto} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setAlbumForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input type="date" value={albumForm.photoDate} onChange={(event) => setAlbumForm((current) => ({ ...current, photoDate: event.target.value, ageLabel: deriveAgeLabel(event.target.value ? new Date(event.target.value) : undefined, person.dateOfBirth ? new Date(person.dateOfBirth) : undefined) }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select value={albumForm.albumCategory} onChange={(event) => setAlbumForm((current) => ({ ...current, albumCategory: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="PORTRAIT">Portrait</option>
                  <option value="GROUP">Group</option>
                </select>
                <input value={albumForm.locationLabel} onChange={(event) => setAlbumForm((current) => ({ ...current, locationLabel: event.target.value }))} placeholder="Location" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input value={albumForm.ageLabel} onChange={(event) => setAlbumForm((current) => ({ ...current, ageLabel: event.target.value }))} placeholder="Age period label" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input value={albumForm.peopleTags} onChange={(event) => setAlbumForm((current) => ({ ...current, peopleTags: event.target.value }))} placeholder="People tags, comma separated" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <textarea value={albumForm.caption} onChange={(event) => setAlbumForm((current) => ({ ...current, caption: event.target.value }))} placeholder="Description / context" rows={3} className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={albumForm.isGroupPhoto} onChange={(event) => setAlbumForm((current) => ({ ...current, isGroupPhoto: event.target.checked }))} className="h-4 w-4" />
                This is a group photo
              </label>
              <div className="mt-4 flex items-center gap-3">
                <button type="submit" disabled={uploading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {uploading ? 'Uploading...' : 'Add to album'}
                </button>
                <span className="text-xs text-slate-500">Images are stored in the application database and streamed through protected routes.</span>
              </div>
            </form>
          ) : null}
          {albumMessage ? <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{albumMessage}</div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPhotos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={`/api/photo/${photo.id}`} alt={photo.caption ?? 'Life history photo'} className="h-52 w-full object-cover" />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                      {photo.albumCategory ?? 'PORTRAIT'}
                    </div>
                    {photo.ageLabel ? <div className="text-xs text-slate-500">{photo.ageLabel}</div> : null}
                  </div>
                  {photo.caption ? <p className="text-sm text-slate-700">{photo.caption}</p> : <p className="text-sm text-slate-500">No description provided.</p>}
                  <div className="text-xs text-slate-500">
                    {[formatDate(photo.date), photo.locationLabel].filter(Boolean).join(' • ')}
                  </div>
                  {Array.isArray(photo.peopleTags) && photo.peopleTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {photo.peopleTags.map((tag) => (
                        <span key={`${photo.id}-${String(tag)}`} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                          {String(tag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {permission.canEdit ? (
                    <button type="button" onClick={() => deletePhoto(photo.id)} className="text-sm font-medium text-rose-600 hover:underline">
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

