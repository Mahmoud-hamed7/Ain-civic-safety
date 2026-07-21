import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Search, ChevronLeft, ChevronRight, Users, MapPin,
  Archive, Sparkles, Eye, AlertTriangle, UserPlus, Trash2,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import CommunityTypeBadge from '../../components/Community/CommunityTypeBadge';
import InviteCodeCell from '../../components/Community/InviteCodeCell';
import { TILE_URL, createCustomIcon } from '../../utils/map';
import { parseCommunityAdminResponse, shortCommunityId, isNeighborhoodCommunity } from '../../utils/communities';
import { communityApi, patchCommunityInviteCodeInCache } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import type { CommunityType } from '../../types';

function CentroidMapPopup({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-start gap-0.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-start"
        title="Open on map"
      >
        <span className="flex items-center gap-1 font-medium">
          <MapPin className="w-3.5 h-3.5" /> View on map
        </span>
        <span className="text-[10px] text-gray-500 font-mono" dir="ltr">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-bold text-white text-start">{name} — Centroid</p>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="h-64">
              <MapContainer center={[lat, lng]} zoom={13} className="h-full w-full">
                <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
                <Marker position={[lat, lng]} icon={createCustomIcon('#6366f1', 18)}>
                  <Popup>{name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminCommunities() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SuperAdmin'));

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CommunityType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<{ id: string; name: string } | null>(null);

  const TYPE_FILTERS: { label: string; value: CommunityType | 'all' }[] = [
    { label: t('admin_communities.all_types', 'All types'), value: 'all' },
    { label: t('admin_communities.neighborhood', 'Neighborhood'), value: 0 },
    { label: t('admin_communities.building', 'Building'), value: 1 },
    { label: t('admin_communities.private', 'Private Group'), value: 2 },
  ];

  const pageSize = 20;

  const listParams = { search, page, typeFilter };
  const { data, isLoading } = useQuery({
    queryKey: communityKeys.list(listParams),
    queryFn: async () => {
      const res = await communityApi.getAll({
        pageNumber: page,
        pageSize,
        search: search || undefined,
        communityType: typeFilter !== 'all' ? typeFilter : undefined,
      });
      return parseCommunityAdminResponse(res);
    },
  });

  const communities = data?.communities ?? [];
  const totalCount = data?.totalCount ?? communities.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize), data?.totalPages ?? 1);

  const nameCounts = new Map<string, number>();
  for (const c of communities) {
    nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  }

  const { mutate: regenerateCode } = useMutation({
    mutationFn: (communityId: string) => communityApi.regenerateInviteCode(communityId),
    onSuccess: (result, communityId) => {
      patchCommunityInviteCodeInCache(qc, result.communityId || communityId, result.inviteCode, result.inviteCodeExpiresAt);
      qc.invalidateQueries({ queryKey: [...communityKeys.detail(communityId), 'invite-code'] });
      addToast({ type: 'success', title: 'Invite code generated', description: result.inviteCode ? `Code: ${result.inviteCode}` : undefined });
      setRegeneratingId(null);
    },
    onError: (error) => {
      addToast({ type: 'error', title: 'Failed to generate invite code', description: extractCommunityApiError(error) });
      setRegeneratingId(null);
    },
  });

  const { mutate: archiveCommunity, isPending: archiving } = useMutation({
    mutationFn: (id: string) => communityApi.archiveCommunity(id),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Community archived' });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
      setArchiveTarget(null);
    },
    onError: (error) => {
      addToast({ type: 'error', title: 'Error', description: extractCommunityApiError(error) });
      setArchiveTarget(null);
    },
  });

  const { mutate: deleteCommunity, isPending: deleting } = useMutation({
    mutationFn: (id: string) => communityApi.deleteCommunity(id),
    onSuccess: (_d, id) => {
      addToast({ type: 'success', title: 'Community deleted', description: `"${deleteTarget?.name}" has been permanently deleted.` });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const description =
        status === 403 || status === 404
          ? 'Only the community owner can delete this community.'
          : extractCommunityApiError(error);
      addToast({ type: 'error', title: 'Delete failed', description });
      setDeleteTarget(null);
    },
  });

  const { mutate: bulkRegenerate, isPending: bulkRegenerating } = useMutation({
    mutationFn: () => communityApi.bulkRegenerateInviteCodes(),
    onSuccess: (result) => {
      addToast({
        type: 'success',
        title: 'Bulk regenerate complete',
        description: result.message ?? `Generated codes for ${result.updatedCommunities ?? result.count} communities`,
      });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
    },
    onError: (error) => {
      addToast({ type: 'error', title: 'Bulk regenerate failed', description: extractCommunityApiError(error) });
    },
  });

  const openDetail = (id: string) => navigate(`/admin/communities/${id}`);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 text-start">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin_communities.title', 'Community Management')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('admin_communities.subtitle', '{{count}} communities system-wide').replace('{{count}}', String(totalCount))}</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => bulkRegenerate()}
            disabled={bulkRegenerating}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-50 transition-colors"
          >
            <Sparkles className={`w-4 h-4 ${bulkRegenerating ? 'animate-spin' : ''}`} />
            {t('admin_communities.bulk_regenerate', 'Bulk Regenerate Invite Codes')}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin_communities.search', 'Search by community name…')}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors text-start"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            const v = e.target.value;
            setTypeFilter(v === 'all' ? 'all' : (Number(v) as CommunityType));
            setPage(1);
          }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
        >
          {TYPE_FILTERS.map(({ label, value }) => (
            <option key={String(value)} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {[
                    t('admin_communities.table_name', 'Name'),
                    t('admin_communities.table_type', 'Type'),
                    t('admin_communities.table_desc', 'Description'),
                    t('admin_communities.table_members', 'Members'),
                    t('admin_communities.table_creator', 'Creator'),
                    t('admin_communities.table_created', 'Created'),
                    t('admin_communities.table_centroid', 'Centroid'),
                    t('admin_communities.table_invite', 'Invite Code'),
                    t('admin_communities.table_actions', 'Actions')
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {communities.map((c) => {
                  const isDuplicate = (nameCounts.get(c.name) ?? 0) > 1;
                  const pending = c.pendingJoinRequestCount ?? 0;
                  return (
                    <tr key={c.id} className={`hover:bg-gray-800/30 transition-colors ${c.isArchived ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openDetail(c.id)} className="font-semibold text-white hover:text-indigo-300 hover:underline text-start cursor-pointer">
                          {c.name}
                        </button>
                        <p className="text-[10px] font-mono text-gray-500 mt-0.5" title={c.id} dir="ltr">
                          …{shortCommunityId(c.id)}
                        </p>
                        {isDuplicate && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Duplicate name
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><CommunityTypeBadge type={c.communityType} /></td>
                      <td className="px-4 py-3 max-w-[160px]"><p className="text-xs text-gray-400 truncate text-start">{c.description ?? '—'}</p></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                            <Users className="w-4 h-4 text-indigo-400" /> {c.memberCount}
                          </span>
                          {isNeighborhoodCommunity(c.communityType) && pending > 0 && (
                            <Link to={`/admin/communities/${c.id}?tab=join-requests`} className="inline-flex items-center gap-1 w-fit text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full hover:bg-amber-400/20">
                              <UserPlus className="w-3 h-3" /> {pending} pending
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 text-start">{c.createdByName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap" dir="auto">
                        {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.centroidLatitude != null && c.centroidLongitude != null ? (
                          <CentroidMapPopup lat={c.centroidLatitude} lng={c.centroidLongitude} name={c.name} />
                        ) : (
                          <span className="text-xs text-gray-500">No location data</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InviteCodeCell
                          communityId={c.id}
                          inviteCode={c.inviteCode}
                          inviteCodeExpiresAt={c.inviteCodeExpiresAt}
                          communityType={c.communityType}
                          regenerating={regeneratingId === c.id}
                          onRegenerate={() => { setRegeneratingId(c.id); regenerateCode(c.id); }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <button type="button" onClick={() => openDetail(c.id)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300">
                            <Eye className="w-3 h-3" /> {t('admin_communities.view', 'View')}
                          </button>
                          {!c.isArchived && (
                            <button type="button" onClick={() => setArchiveTarget({ id: c.id, name: c.name })} className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300">
                              <Archive className="w-3 h-3" /> {t('admin_communities.archive', 'Archive')}
                            </button>
                          )}
                          <button type="button" onClick={() => setDeleteTarget({ id: c.id, name: c.name })} className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300">
                            <Trash2 className="w-3 h-3" /> {t('admin_communities.delete', 'Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {communities.length === 0 && <p className="text-center py-12 text-gray-500 text-sm">{t('admin_communities.no_communities', 'No communities found.')}</p>}
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages} · Showing {communities.length} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive Community"
        message={<>Archive <strong className="text-white">{archiveTarget?.name}</strong>? Members will lose access.</>}
        confirmText="Archive"
        isLoading={archiving}
        onConfirm={() => archiveTarget && archiveCommunity(archiveTarget.id)}
        onCancel={() => setArchiveTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Community Permanently"
        message={<>Permanently delete <strong className="text-white">{deleteTarget?.name}</strong>? This cannot be undone — all members and data will be removed.</>}
        confirmText="Delete Forever"
        isLoading={deleting}
        onConfirm={() => deleteTarget && deleteCommunity(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}