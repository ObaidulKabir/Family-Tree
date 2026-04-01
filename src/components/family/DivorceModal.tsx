'use client';

import { useState } from 'react';
import { updateRelationship } from '@/actions/family';
import { X } from 'lucide-react';

interface DivorceModalProps {
  personId: string;
  spouse: {
    id: string;
    firstName: string;
    lastName?: string | null;
    marriageDate?: string | Date | null;
    marriagePlace?: string | null;
    divorceDate?: string | Date | null;
    divorcePlace?: string | null;
    isDivorced?: boolean;
  };
  onClose: () => void;
  onSuccess: () => void;
  initialStatus?: 'MARRIED' | 'DIVORCED';
}

function toInputDate(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export default function DivorceModal({ personId, spouse, onClose, onSuccess, initialStatus }: DivorceModalProps) {
  const [status, setStatus] = useState<'MARRIED' | 'DIVORCED'>(initialStatus ?? (spouse.isDivorced ? 'DIVORCED' : 'MARRIED'));
  const [marriageDate, setMarriageDate] = useState(toInputDate(spouse.marriageDate));
  const [marriagePlace, setMarriagePlace] = useState(spouse.marriagePlace ?? '');
  const [divorceDate, setDivorceDate] = useState(toInputDate(spouse.divorceDate));
  const [divorcePlace, setDivorcePlace] = useState(spouse.divorcePlace ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await updateRelationship(personId, spouse.id, {
        status,
        marriageDate: marriageDate ? new Date(marriageDate) : undefined,
        marriagePlace: marriagePlace || undefined,
        divorceDate: status === 'DIVORCED' && divorceDate ? new Date(divorceDate) : undefined,
        divorcePlace: status === 'DIVORCED' ? divorcePlace || undefined : undefined,
      });
      
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Edit Relationship</h3>
            <p className="text-sm text-gray-500">
              Update marriage and divorce details for {spouse.firstName} {spouse.lastName}.
            </p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-500 p-2 rounded text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-2">Relationship Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('MARRIED')}
                className={`rounded border px-3 py-2 text-sm font-medium ${status === 'MARRIED' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Married
              </button>
              <button
                type="button"
                onClick={() => setStatus('DIVORCED')}
                className={`rounded border px-3 py-2 text-sm font-medium ${status === 'DIVORCED' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Divorced
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Marriage Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={marriageDate}
              onChange={e => setMarriageDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Marriage Place</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={marriagePlace}
              onChange={e => setMarriagePlace(e.target.value)}
              placeholder="Leave blank if unknown"
            />
          </div>

          {status === 'DIVORCED' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Divorce Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={divorceDate}
                  onChange={e => setDivorceDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Divorce Place</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={divorcePlace}
                  onChange={e => setDivorcePlace(e.target.value)}
                  placeholder="Leave blank if unknown"
                />
              </div>
            </>
          ) : null}

          <p className="text-xs text-gray-500">Leave dates or places blank if the exact details are unknown.</p>

          <div className="pt-2 flex gap-3">
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
              className={`flex-1 px-4 py-2 text-white rounded disabled:opacity-50 ${status === 'DIVORCED' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {loading ? 'Saving...' : status === 'DIVORCED' ? 'Save Divorce' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
