import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  UserCircle, Phone, Mail, Shield, Camera,
  Edit3, Save, X, Star, BadgeCheck, MapPin, Navigation, AlertTriangle, CheckCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import MediaImage from '../../components/MediaImage';
import Skeleton from '../../components/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { communityKeys } from '../../queryKeys';

function TrustBadge({ badge }: { badge?: string }) {
  const { t } = useTranslation();
  const styles: Record<string, { bg: string; text: string; icon: React.ReactElement }> = {
    Newcomer:    { bg: 'bg-gray-500/15',    text: 'text-gray-400',    icon: <Star className="w-3.5 h-3.5" />       },
    Trusted:     { bg: 'bg-blue-500/15',    text: 'text-blue-400',    icon: <BadgeCheck className="w-3.5 h-3.5" /> },
    Verified:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: <Shield className="w-3.5 h-3.5" />     },
    Contributor: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  icon: <Star className="w-3.5 h-3.5" />       },
  };
  const key = badge ?? 'Newcomer';
  const s   = styles[key] ?? styles.Newcomer;
  // Fallback to key if translation missing
  const label = t(`profile.${key.toLowerCase()}`, key);
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-current/20 ${s.bg} ${s.text}`}>
      {s.icon}
      {label}
    </span>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const qc       = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const user     = useAuthStore((s) => s.user);

  const [editing,     setEditing]     = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError,   setLocationError]   = useState<'denied' | 'timeout' | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  () => apiClient.get('/api/profile/my-profile').then((r) => r.data),
  });
  const data = rawData as any;

  useState(() => {
    if (data?.displayName) setDisplayName(data.displayName);
    if (data?.phoneNumber) setPhoneNumber(data.phoneNumber);
  });

  const { mutate: updateProfile, isPending: saving } = useMutation({
    mutationFn: () => apiClient.put('/api/profile/update', { displayName, phoneNumber }),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Profile updated', description: 'Your profile has been saved.' });
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Update failed', description: e?.response?.data?.message ?? 'Please try again.' }),
  });

  const { mutate: uploadAvatar } = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return apiClient.post('/api/profile/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onMutate:  () => setAvatarUploading(true),
    onSettled: () => setAvatarUploading(false),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Avatar updated', description: 'Your profile photo has been saved.' });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Upload failed', description: e?.response?.data?.message ?? 'Please try again.' }),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar(file);
    e.target.value = '';
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      addToast({ type: 'error', title: 'Not supported', description: 'Geolocation is not supported by your browser.' });
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiClient.put('/api/profile/location', {
            latitude:       pos.coords.latitude,
            longitude:      pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy ?? undefined,
          });
          addToast({ type: 'success', title: 'Location saved', description: 'Your emergency location has been updated.' });
          qc.invalidateQueries({ queryKey: ['profile'] });
          qc.invalidateQueries({ queryKey: communityKeys.myList() });
        } catch (e: any) {
          addToast({ type: 'error', title: 'Save failed', description: e?.response?.data?.message ?? 'Could not save location.' });
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === 1) setLocationError('denied');
        else setLocationError('timeout');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton type="card" className="h-40" />
        <Skeleton type="card" className="h-52" />
      </div>
    );
  }

  const initials = (data?.displayName ?? user?.displayName ?? 'U')[0].toUpperCase();
  const avatarSrc = data?.avatarUrl ?? data?.profilePhotoUrl ?? data?.AvatarUrl ?? data?.ProfilePhotoUrl;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">{t('profile.title', 'My Profile')}</h1>

      {/* ── Profile hero card ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-black overflow-hidden">
              {avatarUploading ? (
                <span className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
              ) : avatarSrc ? (
                <MediaImage src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors"
            >
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{data?.displayName ?? t('profile.unknown', 'Unknown')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{data?.email ?? user?.email}</p>
              </div>
              <button
                onClick={() => { setEditing((e) => !e); if (!editing) { setDisplayName(data?.displayName ?? ''); setPhoneNumber(data?.phoneNumber ?? ''); } }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  editing ? 'text-red-400 bg-red-400/10 border border-red-400/20' : 'text-indigo-400 bg-indigo-400/10 border border-indigo-400/20'
                }`}
              >
                {editing ? <><X className="w-3.5 h-3.5" /> {t('profile.cancel', 'Cancel')}</> : <><Edit3 className="w-3.5 h-3.5" /> {t('profile.edit', 'Edit')}</>}
              </button>
            </div>
            <div className="mt-3">
              <TrustBadge badge={data?.trustBadge} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal information ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white">{t('profile.personal_info', 'Personal Information')}</h3>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <UserCircle className="w-3.5 h-3.5" /> {t('profile.display_name', 'Display Name')}
          </label>
          {editing ? (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-800 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors text-start"
            />
          ) : (
            <p className="text-sm text-white bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-2.5">
              {data?.displayName ?? '—'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {t('profile.phone_number', 'Phone Number')}
          </label>
          {editing ? (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              type="tel"
              className="w-full bg-gray-800 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors text-start"
            />
          ) : (
            <p className="text-sm text-white bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-2.5">
              {data?.phoneNumber ?? '—'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {t('profile.email', 'Email')}
          </label>
          <p className="text-sm text-gray-400 bg-gray-800/30 border border-gray-800 rounded-xl px-4 py-2.5">
            {data?.email ?? user?.email ?? '—'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> {t('profile.role', 'Role')}
          </label>
          <p className="text-sm text-gray-400 bg-gray-800/30 border border-gray-800 rounded-xl px-4 py-2.5">
            {Array.isArray(user?.role) ? user.role.join(', ') : (user?.role ?? 'Citizen')}
          </p>
        </div>

        {editing && (
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
            >
              {t('profile.cancel', 'Cancel')}
            </button>
            <button
              onClick={() => updateProfile()}
              disabled={saving || !displayName.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-40"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : <Save className="w-4 h-4" />}
              {t('profile.save_changes', 'Save Changes')}
            </button>
          </div>
        )}
      </div>

      {/* ── Emergency Location ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-400" /> {t('profile.emergency_location', 'Emergency Location')}
        </h3>

        {data?.latitude != null && data?.longitude != null ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-300">{t('profile.location_set', 'Location set')}</p>
              <p className="text-[11px] text-emerald-400/70 font-mono" dir="ltr">
                {Number(data.latitude).toFixed(5)}, {Number(data.longitude).toFixed(5)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-semibold text-amber-300">{t('profile.not_set', 'Not set — SOS features inactive')}</p>
          </div>
        )}

        {locationError === 'denied' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              {t('profile.location_denied', 'Location access denied. Enable location permissions in your browser settings.')}
            </p>
          </div>
        )}
        {locationError === 'timeout' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="flex-1 text-xs text-amber-300">{t('profile.location_timeout', 'Location timed out.')}</p>
            <button
              onClick={handleShareLocation}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
            >
              {t('profile.retry', 'Retry')}
            </button>
          </div>
        )}

        <button
          onClick={handleShareLocation}
          disabled={locationLoading}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors"
        >
          {locationLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('profile.acquiring_gps', 'Acquiring GPS…')}
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              {data?.latitude != null ? t('profile.update_location', 'Update Location') : t('profile.share_location', 'Share My Location')}
            </>
          )}
        </button>
      </div>

      {/* ── Activity stats ── */}
      {data && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">{t('profile.activity', 'Activity')}</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('profile.reports_filed', 'Reports Filed'), value: data.totalReports    ?? 0 },
              { label: t('profile.resolved', 'Resolved'),           value: data.resolvedReports ?? 0 },
              { label: t('profile.communities', 'Communities'),     value: data.communityCount  ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white tabular-nums">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}