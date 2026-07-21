import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 استدعاء الترجمة
import { Users, Globe2, Plus, AlertTriangle } from 'lucide-react';
import {
  communityApi,
  patchCommunityInviteCodeInCache,
  forgetCommunityInviteCode,
} from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import { hasAnyLocationPending } from '../../utils/citizenCommunities';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import MyCommunityCard from '../../components/Community/citizen/MyCommunityCard';
import InviteCodeJoinPanel from '../../components/Community/citizen/InviteCodeJoinPanel';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import { useAuthUserId } from '../../store/authStore';
import type { JoinCommunityResponse } from '../../types';

export default function Communities() {
  const { t, i18n } = useTranslation(); // 👈 تفعيل الترجمة
  const isRtl = i18n.language.startsWith('ar');

  const qc = useQueryClient();
  const navigate = useNavigate();
  const addToast = useNotificationStore((s) => s.addToast);
  const userId = useAuthUserId();
  const { joinCommunityGroup, leaveCommunityGroup } = useSignalR();

  const [inviteCode, setInviteCode] = useState('');
  const [leaveModal, setLeaveModal] = useState<{ id: string; name: string } | null>(null);
  const [joinResult, setJoinResult] = useState<JoinCommunityResponse | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const { data: myCommunities = [], isLoading } = useQuery({
    queryKey: communityKeys.myList(),
    queryFn: () => communityApi.getMyCommunities(userId),
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: communityKeys.myList() });
  };

  const { mutate: joinByCode, isPending: joiningCode } = useMutation({
    mutationFn: () => communityApi.joinByInviteCode(inviteCode),
    onSuccess: (res) => {
      setJoinResult(res);
      setInviteCode('');
      refetch();
      joinCommunityGroup(res.communityId);
      if (res.requiresLocation) {
        addToast({
          type: 'warning',
          title: res.message || `Joined "${res.communityName}"`,
          description: 'Please share your location to activate SOS.',
        });
      } else {
        addToast({ type: 'success', title: res.message || `Joined "${res.communityName}"!` });
      }
      navigate(`/citizen/communities/${res.communityId}`);
    },
    onError: (error) =>
      addToast({
        type: 'error',
        title: 'Invalid code',
        description: extractCommunityApiError(error),
      }),
  });

  const { mutate: leaveMutation } = useMutation({
    mutationFn: (id: string) => communityApi.leaveCommunity(id),
    onSuccess: (_d, id) => {
      addToast({ type: 'info', title: 'Left community' });
      refetch();
      leaveCommunityGroup(id);
      setLeaveModal(null);
    },
    onError: () => addToast({ type: 'error', title: 'Could not leave community' }),
  });

  const { mutate: regenerateCode } = useMutation({
    mutationFn: (id: string) => communityApi.regenerateInviteCode(id),
    onSuccess: (result, id) => {
      patchCommunityInviteCodeInCache(qc, result.communityId || id, result.inviteCode, result.inviteCodeExpiresAt);
      qc.invalidateQueries({ queryKey: [...communityKeys.detail(id), 'invite-code'] });
      addToast({
        type: 'success',
        title: 'New invite code generated',
        description: result.inviteCode ? `Code: ${result.inviteCode}` : undefined,
      });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to regenerate code' }),
  });

  const { mutate: revokeCode } = useMutation({
    mutationFn: (id: string) => communityApi.revokeInviteCode(id),
    onSuccess: (_d, id) => {
      forgetCommunityInviteCode(id);
      refetch();
      addToast({ type: 'info', title: 'Invite code revoked' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to revoke code' }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {hasAnyLocationPending(myCommunities) && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">{t('communities.location_not_set', 'Location not set')}</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              {t('communities.sos_inactive', 'Some SOS emergency features are inactive until you share your location.')}
            </p>
          </div>
          <Link to="/citizen/profile" className="text-xs font-semibold text-amber-300 hover:text-amber-200 shrink-0">
            {t('communities.update_location', 'Update Location')}
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('communities.title', 'My Communities')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('communities.subtitle', 'Communities you belong to')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-3 py-1.5 rounded-xl">
            <Users className="w-4 h-4" />
            {myCommunities.length} {t('communities.joined', 'joined')}
          </span>
          <Link
            to="/citizen/communities/discover"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-300 bg-gray-800 border border-gray-700 hover:border-gray-600 px-4 py-2 rounded-xl"
          >
            <Globe2 className="w-4 h-4" /> {t('communities.discover', 'Discover')}
          </Link>
          <Link
            to="/citizen/communities/create"
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> {t('communities.create', 'Create')}
          </Link>
        </div>
      </div>

      <InviteCodeJoinPanel
        ref={codeInputRef}
        inviteCode={inviteCode}
        onChange={setInviteCode}
        onJoin={() => joinByCode()}
        joining={joiningCode}
        joinResult={joinResult}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} type="card" className="h-48" />
          ))}
        </div>
      ) : myCommunities.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-400 font-semibold">{t('communities.no_communities', 'You haven\'t joined any communities yet.')}</p>
          <Link to="/citizen/communities/discover" className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            {t('communities.discover_link', 'Discover communities')} {isRtl ? '←' : '→'}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {myCommunities.map((c) => (
            <MyCommunityCard
              key={c.id}
              community={c}
              userId={userId}
              onLeave={(id, name) => setLeaveModal({ id, name })}
              onRegenerate={(id) => regenerateCode(id)}
              onRevoke={(id) => revokeCode(id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!leaveModal}
        title={t('communities.leave_title', 'Leave Community')}
        message={
          <>
            {t('communities.leave_message', 'Leave {{name}}? You can rejoin anytime.').replace('{{name}}', '')}
            <strong className="text-white mx-1">{leaveModal?.name}</strong>
            {t('communities.leave_message', 'Leave {{name}}? You can rejoin anytime.').split('{{name}}')[1]}
          </>
        }
        confirmText={t('communities.leave_confirm', 'Leave')}
        onConfirm={() => leaveModal && leaveMutation(leaveModal.id)}
        onCancel={() => setLeaveModal(null)}
      />
    </div>
  );
}