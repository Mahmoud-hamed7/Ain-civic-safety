import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { ArrowLeft, ArrowRight, Archive, Users, UserPlus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { communityApi, patchCommunityInviteCodeInCache, forgetCommunityInviteCode } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import { normalizeCommunityType, isNeighborhoodCommunity } from '../../utils/communities';
import CommunityTypeBadge from '../../components/Community/CommunityTypeBadge';
import CommunityMembersTable from '../../components/Community/CommunityMembersTable';
import CommunityJoinRequestsPanel from '../../components/Community/CommunityJoinRequestsPanel';
import CommunityInviteCodePanel from '../../components/Community/CommunityInviteCodePanel';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/Skeleton';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore, useAuthUserId } from '../../store/authStore';
import { canChangeRoles, canManageCommunity, canViewInviteCode, resolveEffectiveRole } from '../../utils/communityCitizen';
import { useCommunityInviteCode } from '../../hooks/useCommunityInviteCode';

type Tab = 'info' | 'members' | 'join-requests';

function SosReadinessBar({ percent }: { percent: number }) {
  const { t } = useTranslation();
  const color =
    percent >= 70 ? 'bg-emerald-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 uppercase tracking-wider">{t('community_detail.sos_readiness', 'SOS Readiness')}</span>
        <span className="text-white font-semibold" dir="ltr">{percent}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden text-start">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

export default function CommunityDetailPage({
  readOnly = false,
  backPath,
  citizenMode = false,
  editPath,
}: {
  readOnly?: boolean;
  backPath: string;
  citizenMode?: boolean;
  editPath?: string;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const userId = useAuthUserId();

  const initialTab = (searchParams.get('tab') as Tab) || 'info';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);

  useEffect(() => {
    const tParam = searchParams.get('tab') as Tab;
    if (tParam) setTab(tParam);
  }, [searchParams]);

  const { data: community, isLoading: loadingDetail, isError: detailError } = useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: () => communityApi.getById(id, userId),
    enabled: !!id,
  });

  const { data: myCommunities = [] } = useQuery({
    queryKey: communityKeys.myList(),
    queryFn: () => communityApi.getMyCommunities(userId),
    enabled: citizenMode && !!id,
  });
  const myCitizenRow = myCommunities.find((c) => c.id === id);

  const { data: membersFromApi = [], isLoading: loadingMembers } = useQuery({
    queryKey: communityKeys.members(id),
    queryFn: () => communityApi.getMembersOrFromDetail(id, userId),
    enabled: !!id,
  });

  const displayMembers = membersFromApi.length > 0 ? membersFromApi : (community?.members ?? []);
  const communityType = normalizeCommunityType(community?.communityType);
  const isPlatformAdmin = !citizenMode && !readOnly;
  const isAuthorityPortal = !citizenMode && readOnly;

  const myRole = resolveEffectiveRole(userId, {
    communityRole: community?.myRole,
    createdById: community?.createdById,
    members: displayMembers,
    listRole: myCitizenRow?.myRole,
    listCreatedById: myCitizenRow?.createdById,
  });

  const createdById = community?.createdById ?? myCitizenRow?.createdById ?? null;
  const citizenCanManage =
    citizenMode && canManageCommunity(myRole, createdById, userId);
  const citizenCanDelete =
    citizenMode && (myRole === 'Owner' || (!!createdById && !!userId && createdById.trim() === userId.trim()));
  const showInviteCode = canViewInviteCode(myRole, createdById, userId, isPlatformAdmin);
  const membersReadOnly = !isPlatformAdmin && (readOnly || (citizenMode && !citizenCanManage));
  const joinRequestsReadOnly = !isPlatformAdmin && (readOnly || (citizenMode && !citizenCanManage));
  const showJoinRequestsTab = isPlatformAdmin || isAuthorityPortal || citizenCanManage;
  const canTransferOwnership =
    !membersReadOnly && (citizenMode ? canChangeRoles(myRole) : myRole === 'Owner');

  const { data: joinRequests = [] } = useQuery({
    queryKey: communityKeys.joinRequests(id),
    queryFn: () => communityApi.getJoinRequests(id),
    enabled: !!id && showJoinRequestsTab,
  });
  const pendingJoinCount = joinRequests.filter((r) => r.status === 'Pending').length;

  const { inviteCode: resolvedInviteCode, inviteCodeExpiresAt: resolvedInviteExpires } =
    useCommunityInviteCode(id, {
      fromApi: community?.inviteCode ?? myCitizenRow?.inviteCode,
      fromApiExpires: community?.inviteCodeExpiresAt ?? myCitizenRow?.inviteCodeExpiresAt,
      communityType,
      enabled: !!community && showInviteCode,
    });

  const { mutate: regenerateCode } = useMutation({
    mutationFn: () => communityApi.regenerateInviteCode(id),
    onSuccess: (result) => {
      patchCommunityInviteCodeInCache(qc, result.communityId || id, result.inviteCode, result.inviteCodeExpiresAt);
      qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
      qc.invalidateQueries({ queryKey: [...communityKeys.detail(id), 'invite-code'] });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      addToast({
        type: 'success',
        title: t('community_detail.toast_invite_updated', 'Invite code updated'),
        description: result.inviteCode ? `Code: ${result.inviteCode}` : undefined,
      });
    },
    onError: (error) => {
      addToast({ type: 'error', title: t('common.error', 'Error'), description: extractCommunityApiError(error) });
    },
  });

  const { mutate: revokeCode } = useMutation({
    mutationFn: () => communityApi.revokeInviteCode(id),
    onSuccess: () => {
      forgetCommunityInviteCode(id);
      qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
      qc.invalidateQueries({ queryKey: [...communityKeys.detail(id), 'invite-code'] });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      addToast({ type: 'info', title: t('community_detail.toast_invite_revoked', 'Invite code revoked') });
    },
    onError: (error) => {
      addToast({ type: 'error', title: t('common.error', 'Error'), description: extractCommunityApiError(error) });
    },
  });

  const { mutate: archive, isPending: archiving } = useMutation({
    mutationFn: () => communityApi.archiveCommunity(id),
    onSuccess: () => {
      addToast({ type: 'success', title: t('community_detail.toast_archived', 'Community archived') });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      navigate(backPath);
    },
    onError: (error) => {
      addToast({ type: 'error', title: t('common.error', 'Error'), description: extractCommunityApiError(error) });
      setArchiveOpen(false);
    },
  });

  const { mutate: deleteCommunity, isPending: deleting } = useMutation({
    mutationFn: () => communityApi.deleteCommunity(id),
    onSuccess: () => {
      addToast({ type: 'success', title: t('community_detail.toast_deleted', 'Community deleted'), description: `"${community?.name}" ${t('community_detail.dialog_delete_msg2', 'has been permanently deleted.')}` });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      navigate(backPath);
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const description =
        status === 403 || status === 404
          ? t('community_detail.toast_delete_forbidden', 'Only the community owner can delete this community.')
          : extractCommunityApiError(error);
      addToast({ type: 'error', title: t('common.error', 'Error'), description });
      setDeleteOpen(false);
    },
  });

  const tabs = useMemo(() => {
    const base: { id: Tab; label: string; badge?: number }[] = [
      { id: 'info', label: t('community_detail.info', 'Info') },
      { id: 'members', label: t('community_detail.members', 'Members'), badge: displayMembers.length || community?.memberCount },
    ];
    if (showJoinRequestsTab) {
      base.push({ id: 'join-requests', label: t('community_detail.join_requests', 'Join Requests'), badge: pendingJoinCount || undefined });
    }
    return base;
  }, [showJoinRequestsTab, displayMembers.length, community?.memberCount, pendingJoinCount, t]);

  if (loadingDetail) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton type="card" className="h-24" />
        <Skeleton type="card" className="h-64" />
      </div>
    );
  }

  if (!community && !loadingDetail) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>{detailError ? t('community_detail.error_load', 'Could not load community.') : t('community_detail.not_found', 'Community not found.')}</p>
        <Link to={backPath} className="text-indigo-400 text-sm mt-2 inline-block hover:underline">
          {t('community_detail.back_to_list', 'Back to list')}
        </Link>
      </div>
    );
  }

  if (!community) return null;

  const locationPending = myCitizenRow?.userMemberStatus === 'LocationPending';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 text-start">
      {citizenMode && locationPending && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">{t('community_detail.location_required', 'Location Required')}</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              {t('community_detail.location_desc', 'Share your location in Profile to activate SOS emergency features.')}
            </p>
          </div>
          <Link to="/citizen/profile" className="text-xs font-semibold text-amber-300 hover:text-amber-200 shrink-0">
            {t('community_detail.update_location', 'Update Location')}
          </Link>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Link to={backPath} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors">
          {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{community.name}</h1>
            <CommunityTypeBadge type={communityType} />
            {community.isArchived && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{t('community_detail.archived', 'Archived')}</span>
            )}
            {(citizenCanManage || isPlatformAdmin) && editPath && (
              <Link
                to={editPath}
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Pencil className="w-3.5 h-3.5" /> {t('community_detail.edit', 'Edit')}
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{community.description ?? t('community_detail.no_desc', 'No description')}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map((tItem) => (
          <button
            key={tItem.id}
            type="button"
            onClick={() => setTab(tItem.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === tItem.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tItem.label}
            {tItem.badge != null && tItem.badge > 0 && (
              <span className="ms-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {tItem.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {tab === 'info' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.total_members', 'Total Members')}</p>
                <p className="text-white font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  {community.totalMemberCount ?? community.memberCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.active', 'Active')}</p>
                <p className="text-emerald-400 font-semibold">{community.activeMemberCount ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.location_pending', 'Location Pending')}</p>
                <p className="text-amber-400 font-semibold">{community.locationPendingCount ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.inactive', 'Inactive')}</p>
                <p className="text-gray-400 font-semibold">{community.inactiveMemberCount ?? '—'}</p>
              </div>
              {community.coverageRadiusMeters != null && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.coverage', 'Coverage')}</p>
                  <p className="text-gray-300" dir="ltr">{community.coverageRadiusMeters} m</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.created_by', 'Created by')}</p>
                <p className="text-white">{community.createdByName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.created', 'Created')}</p>
                <p className="text-gray-300" dir="ltr">
                  {community.createdAt ? format(new Date(community.createdAt), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              {myRole && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('community_detail.your_role', 'Your role')}</p>
                  <p className="text-white">{t(`admin_users.roles_label.${myRole.toLowerCase()}`, myRole)}</p>
                </div>
              )}
            </div>

            {community.sosReadinessPercent != null && (
              <SosReadinessBar percent={community.sosReadinessPercent} />
            )}

            {showInviteCode && (
              <CommunityInviteCodePanel
                communityId={id}
                inviteCode={resolvedInviteCode ?? community.inviteCode}
                inviteCodeExpiresAt={resolvedInviteExpires ?? community.inviteCodeExpiresAt}
                readOnly={!isPlatformAdmin && !citizenCanManage}
                onRegenerate={isPlatformAdmin || citizenCanManage ? () => regenerateCode() : undefined}
                onRevoke={isPlatformAdmin || citizenCanManage ? () => revokeCode() : undefined}
              />
            )}

            {(isPlatformAdmin || (citizenMode && citizenCanManage)) && (
              <div className="pt-6 border-t border-gray-800 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setArchiveOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl hover:bg-red-400/20 transition-colors"
                >
                  <Archive className="w-4 h-4" /> {t('community_detail.archive_btn', 'Archive Community')}
                </button>
                {(isPlatformAdmin || citizenCanDelete) && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> {t('community_detail.delete_btn', 'Delete Permanently')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          loadingMembers && displayMembers.length === 0 ? (
            <Skeleton type="card" className="h-48" />
          ) : displayMembers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">{t('community_detail.no_members', 'No members found.')}</p>
          ) : (
            <CommunityMembersTable
              communityId={id}
              members={displayMembers}
              readOnly={membersReadOnly}
              canTransferOwnership={canTransferOwnership}
            />
          )
        )}

        {tab === 'join-requests' && showJoinRequestsTab && (
          <div>
            <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              {t('community_detail.pending_join', 'Pending join requests')}
              {isNeighborhoodCommunity(communityType) ? t('community_detail.neighborhood', ' (Neighborhood)') : ''}
            </p>
            <CommunityJoinRequestsPanel communityId={id} readOnly={joinRequestsReadOnly} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title={t('community_detail.dialog_archive_title', 'Archive Community')}
        message={t('community_detail.dialog_archive_msg', 'Archive this community? Members will lose access.')}
        confirmText={t('common.archive', 'Archive')}
        isLoading={archiving}
        onConfirm={() => archive()}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t('community_detail.dialog_delete_title', 'Delete Community Permanently')}
        message={<>{t('community_detail.dialog_delete_msg1', 'Permanently delete')} <strong className="text-white mx-1">{community?.name}</strong>{t('community_detail.dialog_delete_msg2', '? This cannot be undone — all members, data, and invite codes will be removed.')}</>}
        confirmText={t('community_detail.delete_btn', 'Delete Forever')}
        isLoading={deleting}
        onConfirm={() => deleteCommunity()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}