'use client';

import { useMemo, useState } from 'react';
import { reassignChildToSpouse } from '@/actions/family';
import { X } from 'lucide-react';
import { getAssociableChildrenForSpouse } from '@/lib/familyAssociation';

interface AssociateChildModalProps {
  personId: string;
  spouse: {
    id: string;
    familyId?: string;
    firstName: string;
    lastName?: string | null;
  };
  availableChildren: Array<{
    id: string;
    firstName: string;
    lastName?: string | null;
    nickName?: string | null;
    childOfFamilyId?: string | null;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

function getChildLabel(child: { firstName: string; lastName?: string | null; nickName?: string | null }) {
  const fullName = `${child.firstName} ${child.lastName ?? ''}`.trim()
  const nickName = child.nickName?.trim()
  if (!nickName) return fullName
  return `${nickName} (${fullName})`
}

export default function AssociateChildModal({ personId, spouse, availableChildren, onClose, onSuccess }: AssociateChildModalProps) {
  const eligibleChildren = useMemo(
    () => getAssociableChildrenForSpouse(availableChildren, spouse.familyId),
    [availableChildren, spouse.familyId]
  );
  const [childId, setChildId] = useState(eligibleChildren[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spouse.familyId) {
      setError('Selected spouse is not linked to a family yet.');
      return;
    }
    if (!childId) {
      setError('Please select a child to associate.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await reassignChildToSpouse(personId, spouse.id, spouse.familyId, childId);

      if ('error' in result) {
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
            <h3 className="font-semibold text-lg">Change Child Association</h3>
            <p className="text-sm text-gray-500">
              Assign an existing child to {spouse.firstName} {spouse.lastName}.
            </p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error ? <div className="bg-red-50 text-red-500 p-2 rounded text-sm">{error}</div> : null}

          {eligibleChildren.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
              All current children are already associated with this spouse, or no eligible children are available.
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Select Child</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={childId}
                onChange={e => setChildId(e.target.value)}
              >
                {eligibleChildren.map((child) => (
                  <option key={child.id} value={child.id}>
                    {getChildLabel(child)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                This updates which spouse/family unit the child belongs to and records an audit event.
              </p>
            </div>
          )}

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
              disabled={loading || eligibleChildren.length === 0}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
