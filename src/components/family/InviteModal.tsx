'use client';

import { useState } from 'react';
import { inviteUser } from '@/actions/invitation';
import { X, Copy, Check } from 'lucide-react';

export default function InviteModal({ personId, personName, onClose }: any) {
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
        const result = await inviteUser(personId, email);
        if (result.error) {
            setError(result.error);
        } else if (result.link) {
            setInviteLink(result.link);
        }
    } catch (e) {
        setError("Failed to generate invite");
    } finally {
        setLoading(false);
    }
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold text-lg">Invite to claim {personName}</h3>
            <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="p-4 space-y-4">
            {!inviteLink ? (
                <form onSubmit={handleInvite} className="space-y-4">
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    <div>
                        <label className="block text-sm font-medium mb-1">Email (Optional for tracking)</label>
                        <input 
                            type="email"
                            className="w-full border rounded px-3 py-2"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="user@example.com"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Currently we just generate a link. Email is recorded but not sent automatically in this demo.
                        </p>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Generating Link...' : 'Generate Invite Link'}
                    </button>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-green-50 text-green-700 rounded text-center text-sm">
                        Invitation link generated!
                    </div>
                    
                    <div className="flex gap-2">
                        <input 
                            readOnly
                            className="w-full border rounded px-3 py-2 bg-gray-50 text-sm"
                            value={inviteLink}
                        />
                        <button 
                            onClick={copyToClipboard}
                            className="p-2 border rounded hover:bg-gray-100"
                            title="Copy"
                        >
                            {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                        </button>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="w-full px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
