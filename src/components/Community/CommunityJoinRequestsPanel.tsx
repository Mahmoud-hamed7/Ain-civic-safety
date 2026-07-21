import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import Skeleton from '../Skeleton';
import { useNotificationStore } from '../../store/notificationStore';

export default function CommunityJoinRequestsPanel({
  communityId,
  readOnly = false,
}: {
  communityId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: communityKeys.joinRequests(communityId),
    queryFn: () => communityApi.getJoinRequests(communityId),
    enabled: !!communityId,
  });

  const pending = requests.filter((r) => r.status === 'Pending');

  const onError = (error: unknown) => {
    addToast({ type: 'error', title: 'Error', description: extractCommunityApiError(error) });
  };

  const { mutate: approve } = useMutation({
    mutationFn: (userId: string) => communityApi.approveJoinRequest(communityId, userId),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Request approved' });
      qc.invalidateQueries({ queryKey: communityKeys.joinRequests(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.members(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
    },
    onError,
  });

  const { mutate: reject } = useMutation({
    mutationFn: (userId: string) => communityApi.rejectJoinRequest(communityId, userId),
    onSuccess: () => {
      addToast({ type: 'info', title: 'Request rejected' });
      qc.invalidateQueries({ queryKey: communityKeys.joinRequests(communityId) });
    },
    onError,
  });

  if (isLoading) return <Skeleton type="card" className="h-32" />;

  if (pending.length === 0) {
    return (
      <p className="text-center py-12 text-gray-500 text-sm">No pending join requests</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/60 border-b border-gray-800">
            {['User Name', 'Requested At', ...(readOnly ? [] : ['Actions'])].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {pending.map((req) => (
            <tr key={req.userId} className="hover:bg-gray-800/30">
              <td className="px-4 py-3 font-medium text-white">{req.userName}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {req.requestedAt ? format(new Date(req.requestedAt), 'MMM d, yyyy HH:mm') : '—'}
              </td>
              {!readOnly && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approve(req.userId)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => reject(req.userId)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg hover:bg-red-400/20"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
