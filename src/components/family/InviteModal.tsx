'use client';

import { useState } from 'react';
import { inviteUser } from '@/actions/invitation';
import { searchUsers } from '@/actions/users';
import { X, Copy, Check } from 'lucide-react';

export default function InviteModal({ personId, personName, onClose }: { personId: string, personName: string, onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const result = await searchUsers({ query: userQuery });
      if (result.error) {
        setError(result.error);
        setUsers([]);
        return;
      }
      setUsers(result.users);
    } catch {
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

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
    } catch {
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

  const sendEmail = () => {
    if (!inviteLink || !email) return;
    const subject = `Invitation to claim ${personName}`;
    const body = `You have been invited to claim a profile in a family tree.\n\nOpen this link:\n${inviteLink}\n`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
            <div>
              <h3 className="font-semibold text-lg">Invite to claim profile</h3>
              <p className="text-sm text-gray-500">Choose who should manage {personName}&rsquo;s details.</p>
            </div>
            <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="p-4 space-y-4">
            {!inviteLink ? (
                <form onSubmit={handleInvite} className="space-y-4">
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                        You are inviting <span className="font-semibold">{personName}</span> to be claimed by a trusted user.
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email address</label>
                        <input 
                            type="email"
                            className="w-full border rounded px-3 py-2"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="user@example.com"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Optional for tracking. You can also pick an existing user or share a generated link manually.
                        </p>
                    </div>

                    <div className="border rounded p-3 space-y-3">
                        <div className="text-sm font-medium text-gray-700">Who are you inviting?</div>
                        <button
                            type="button"
                            onClick={() => {
                              const next = !showUserPicker
                              setShowUserPicker(next)
                              if (next && users.length === 0) loadUsers()
                            }}
                            className="w-full px-3 py-2 text-sm border rounded hover:bg-gray-50"
                        >
                            {showUserPicker ? 'Hide existing users' : 'Pick from existing users'}
                        </button>

                        {showUserPicker && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={userQuery}
                                        onChange={(e) => setUserQuery(e.target.value)}
                                        placeholder="Search by name or email"
                                    />
                                    <button
                                        type="button"
                                        onClick={loadUsers}
                                        disabled={loadingUsers}
                                        className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {loadingUsers ? '...' : 'Search'}
                                    </button>
                                </div>

                                <div className="max-h-40 overflow-auto border rounded">
                                    {users.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-500">No users found</div>
                                    ) : (
                                        <ul className="divide-y">
                                            {users.map((u) => (
                                                <li key={u.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                          setEmail(u.email ?? '')
                                                          setShowUserPicker(false)
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-gray-50"
                                                    >
                                                        <div className="text-sm font-medium">{u.name ?? 'Unnamed user'}</div>
                                                        <div className="text-xs text-gray-500">{u.email ?? ''}</div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Creating invite...' : 'Create invite link'}
                    </button>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="p-3 bg-green-50 text-green-700 rounded text-center text-sm">
                        Invite ready to share
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

                    {email ? (
                        <button
                            onClick={sendEmail}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                            Open email app
                        </button>
                    ) : null}
                    
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
