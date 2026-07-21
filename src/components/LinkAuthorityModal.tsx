/**
 * LinkAuthorityModal — Search citizens + unlinked authorities, then POST link.
 * Used in AdminUsers and AdminDashboard quick actions.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search, Link2, CheckCircle } from 'lucide-react';
import apiClient from '../api/client';
import { authoritiesApi } from '../api/authorities';
import { useNotificationStore } from '../store/notificationStore';

interface Props {
  open:             boolean;
  preselectedUserId?: string;
  onClose:          () => void;
}

export default function LinkAuthorityModal({ open, preselectedUserId, onClose }: Props) {
  const qc   = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [userSearch,      setUserSearch]      = useState('');
  const [authoritySearch, setAuthoritySearch] = useState('');
  const [selectedUserId,  setSelectedUserId]  = useState(preselectedUserId ?? '');
  const [selectedAuthId,  setSelectedAuthId]  = useState('');

  /* Users (citizens) */
  const { data: users } = useQuery({
    queryKey: ['admin', 'users', 'citizens', userSearch],
    queryFn:  () =>
      apiClient.get('/api/admin/users', { params: { role: 'Citizen', search: userSearch || undefined, pageSize: 10 } })
        .then((r) => r.data),
    enabled: open,
  });

  /* Unlinked authorities */
  const { data: authorities } = useQuery({
    queryKey: ['authorities', 'unlinked', authoritySearch],
    queryFn:  async () => {
      const res = await authoritiesApi.getAll(1, 100);
      return res.data.filter((a) =>
        !a.userId && (!authoritySearch || a.name.toLowerCase().includes(authoritySearch.toLowerCase()))
      );
    },
    enabled: open,
  });

  const { mutate: link, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post('/api/admin/link-authority-user', { userId: selectedUserId, authorityId: selectedAuthId }),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Linked', description: 'User linked to authority.' });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['authorities'] });
      onClose();
    },
    onError: (e: any) => {
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Link failed.' });
    },
  });

  if (!open) return null;

  const userList      = users?.users ?? users ?? [];
  const authorityList = authorities ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Link User to Authority</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Users panel */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select Citizen</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {userList.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-blue-600/30 border border-blue-500/50 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                    {(u.displayName ?? u.userName ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.displayName ?? u.userName}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  {selectedUserId === u.id && <CheckCircle className="w-4 h-4 text-blue-400 ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Authorities panel */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select Authority</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                value={authoritySearch}
                onChange={(e) => setAuthoritySearch(e.target.value)}
                placeholder="Search by name…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {authorityList.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAuthId(a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedAuthId === a.id
                      ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                    {a.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 truncate">{a.type ?? 'Authority'}</p>
                  </div>
                  {selectedAuthId === a.id && <CheckCircle className="w-4 h-4 text-purple-400 ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            disabled={!selectedUserId || !selectedAuthId || isPending}
            onClick={() => link()}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Linking…' : 'Link User & Authority'}
          </button>
        </div>
      </div>
    </div>
  );
}
