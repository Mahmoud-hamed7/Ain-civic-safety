import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { ArrowLeft } from 'lucide-react';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import { normalizeCommunityType } from '../../utils/communities';
import { canManageCommunity, resolveEffectiveRole } from '../../utils/communityCitizen';
import Skeleton from '../../components/Skeleton';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthUserId } from '../../store/authStore';
import type { CommunityType } from '../../types';

export default function EditCommunityPage({ adminMode = false }: { adminMode?: boolean }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const userId = useAuthUserId();

  const { data: community, isLoading } = useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: () => communityApi.getById(id, userId),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: communityKeys.members(id),
    queryFn: () => communityApi.getMembersOrFromDetail(id, userId),
    enabled: !!id && !adminMode,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>(0);
  const [coverageRadiusMeters, setCoverageRadiusMeters] = useState('500');

  useEffect(() => {
    if (!community) return;
    setName(community.name);
    setDescription(community.description ?? '');
    setCommunityType(normalizeCommunityType(community.communityType));
    setCoverageRadiusMeters(String(community.coverageRadiusMeters ?? 500));
  }, [community]);

  const myRole = resolveEffectiveRole(userId, {
    communityRole: community?.myRole,
    createdById: community?.createdById,
    members: members.length > 0 ? members : community?.members,
  });
  const canEdit = adminMode || canManageCommunity(myRole, community?.createdById, userId);
  const backPath = adminMode ? `/admin/communities/${id}` : `/citizen/communities/${id}`;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      communityApi.updateCommunity(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        communityType,
        coverageRadiusMeters: communityType !== 2 ? Number(coverageRadiusMeters) || 500 : undefined,
      }),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Community updated' });
      qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      qc.invalidateQueries({ queryKey: communityKeys.list() });
      navigate(backPath);
    },
    onError: (error) =>
      addToast({ type: 'error', title: 'Update failed', description: extractCommunityApiError(error) }),
  });

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500';

  if (isLoading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Skeleton type="card" className="h-64" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>{t('edit_community.no_permission', "You don't have permission to edit this community.")}</p>
        <Link to={backPath} className="text-indigo-400 text-sm mt-2 inline-block">
          {t('edit_community.back_link', 'Back to community')}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={backPath} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
        </Link>
        <h1 className="text-2xl font-bold text-white">{t('edit_community.title', 'Edit Community')}</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t('edit_community.name', 'Name *')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t('edit_community.description', 'Description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>
        {communityType !== 2 && (
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">{t('edit_community.coverage_radius', 'Coverage radius (meters)')}</label>
            <input type="number" value={coverageRadiusMeters} onChange={(e) => setCoverageRadiusMeters(e.target.value)} className={inputCls} />
          </div>
        )}
        <button
          type="button"
          disabled={!name.trim() || isPending}
          onClick={() => mutate()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
        >
          {isPending ? t('edit_community.saving', 'Saving…') : t('edit_community.save_btn', 'Save Changes')}
        </button>
      </div>
    </div>
  );
}