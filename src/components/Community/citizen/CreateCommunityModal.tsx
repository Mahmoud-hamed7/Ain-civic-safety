import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Building2, Home, Lock } from 'lucide-react';
import { communityApi } from '../../../api/community';
import { extractCommunityApiError } from '../../../utils/communityErrors';
import { useNotificationStore } from '../../../store/notificationStore';
import type { CommunityType, CreateCommunityResponse } from '../../../types';

const TYPES: { value: CommunityType; label: string; desc: string; icon: typeof Home }[] = [
  { value: 0, label: 'Neighborhood', desc: 'Open area — members request to join', icon: Home },
  { value: 1, label: 'Building', desc: 'Invite code required to join', icon: Building2 },
  { value: 2, label: 'Private Group', desc: 'Hidden — invite code only', icon: Lock },
];

export default function CreateCommunityModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreateCommunityResponse) => void;
}) {
  const addToast = useNotificationStore((s) => s.addToast);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>(0);
  const [coverageRadiusMeters, setCoverageRadiusMeters] = useState('1000');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      communityApi.createCommunity({
        name: name.trim(),
        description: description.trim() || undefined,
        communityType,
        coverageRadiusMeters:
          communityType === 0 ? Number(coverageRadiusMeters) || 1000 : undefined,
      }),
    onSuccess: (created) => {
      addToast({
        type: 'success',
        title: 'Community created',
        description: created.inviteCode
          ? `Invite code: ${created.inviteCode}`
          : `"${created.name}" is ready — share it with neighbors.`,
      });
      setName('');
      setDescription('');
      setCommunityType(0);
      setCoverageRadiusMeters('1000');
      onCreated(created);
      onClose();
    },
    onError: (error) =>
      addToast({ type: 'error', title: 'Create failed', description: extractCommunityApiError(error) }),
  });

  if (!open) return null;

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-bold text-white">Create Community</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nasr City Block 5"
              className={inputCls}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              rows={2}
              className={`${inputCls} resize-none`}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Type *</label>
            <div className="space-y-2">
              {TYPES.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCommunityType(value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                    communityType === value
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      communityType === value ? 'text-indigo-400' : 'text-gray-500'
                    }`}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${communityType === value ? 'text-white' : 'text-gray-300'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {communityType === 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Coverage radius (meters)
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={coverageRadiusMeters}
                onChange={(e) => setCoverageRadiusMeters(e.target.value)}
                className={inputCls}
              />
              <p className="text-[10px] text-gray-600 mt-1">
                Members within this radius can discover and request to join.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={() => mutate()}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-40"
          >
            {isPending ? 'Creating…' : 'Create Community'}
          </button>
        </div>
      </div>
    </div>
  );
}
