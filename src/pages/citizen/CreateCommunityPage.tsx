import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 استدعاء الترجمة
import { ArrowLeft, Building2, Home, Lock, Key, Copy, CheckCheck } from 'lucide-react';
import { communityApi, patchCommunityInviteCodeInCache } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import type { CommunityType } from '../../types';

export default function CreateCommunityPage() {
  const { t, i18n } = useTranslation(); // 👈 تفعيل الترجمة
  const isRtl = i18n.language.startsWith('ar');

  // 👈 نقلت المصفوفة دي جوه الكومبوننت عشان تستخدم دالة t() براحتها
  const TYPES: { value: CommunityType; label: string; desc: string; icon: typeof Home }[] = [
    { value: 0, label: t('create_community.types.neighborhood', 'Neighborhood'), desc: t('create_community.types.neighborhood_desc', 'Members request to join'), icon: Home },
    { value: 1, label: t('create_community.types.building', 'Building'), desc: t('create_community.types.building_desc', 'Invite code required'), icon: Building2 },
    { value: 2, label: t('create_community.types.private', 'Private Group'), desc: t('create_community.types.private_desc', 'Hidden — invite only'), icon: Lock },
  ];

  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const { joinCommunityGroup } = useSignalR();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>(0);
  const [coverageRadiusMeters, setCoverageRadiusMeters] = useState('500');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      communityApi.createCommunity({
        name: name.trim(),
        description: description.trim() || undefined,
        communityType,
        coverageRadiusMeters:
          communityType !== 2 ? Number(coverageRadiusMeters) || 500 : undefined,
      }),
    onSuccess: (created) => {
      setCreatedCode(created.inviteCode ?? null);
      qc.invalidateQueries({ queryKey: communityKeys.myList() });
      joinCommunityGroup(created.id);
      if (created.inviteCode) {
        patchCommunityInviteCodeInCache(qc, created.id, created.inviteCode, created.inviteCodeExpiresAt);
      }
      addToast({ type: 'success', title: `Community "${created.name}" created!` });
      setTimeout(() => navigate(`/citizen/communities/${created.id}`), 1500);
    },
    onError: (error) =>
      addToast({ type: 'error', title: 'Create failed', description: extractCommunityApiError(error) }),
  });

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500';

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/citizen/communities" className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} /> {/* 👈 لف السهم في العربي */}
        </Link>
        <h1 className="text-2xl font-bold text-white">{t('create_community.title', 'Create Community')}</h1>
      </div>

      {createdCode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <Key className="w-5 h-5 text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">{t('create_community.your_invite_code', 'Your invite code')}</p>
            <p className="font-mono font-bold text-white tracking-widest">{createdCode}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(createdCode).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-emerald-400 hover:text-white"
          >
            {copied ? <CheckCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t('create_community.name', 'Name *')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">{t('create_community.description', 'Description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2">{t('create_community.type', 'Type *')}</label>
          <div className="space-y-2">
            {TYPES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCommunityType(value)}
                // 👈 غيرنا text-left لـ text-start
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-start ${
                  communityType === value ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 ${communityType === value ? 'text-indigo-400' : 'text-gray-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {communityType !== 2 && (
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">{t('create_community.coverage_radius', 'Coverage radius (meters)')}</label>
            <input type="number" min={100} max={10000} value={coverageRadiusMeters} onChange={(e) => setCoverageRadiusMeters(e.target.value)} className={inputCls} />
          </div>
        )}
        <button
          type="button"
          disabled={!name.trim() || isPending}
          onClick={() => mutate()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
        >
          {isPending ? t('create_community.creating', 'Creating…') : t('create_community.create_btn', 'Create Community')}
        </button>
      </div>
    </div>
  );
}