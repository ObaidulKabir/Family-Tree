'use client';

import { useState } from 'react';
import { divorceSpouse } from '@/actions/family';
import { X } from 'lucide-react';

interface DivorceModalProps {
  personId: string;
  spouse: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DivorceModal({ personId, spouse, onClose, onSuccess }: DivorceModalProps) {
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await divorceSpouse(
          personId, 
          spouse.id, 
          date ? new Date(date) : undefined
      );
      
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-lg">Record Divorce</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Record divorce with <strong>{spouse.firstName} {spouse.lastName}</strong>?
          </p>
          
          {error && <div className="bg-red-50 text-red-500 p-2 rounded text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-1">Divorce Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

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
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Divorce'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
