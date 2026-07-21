import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  Siren, AlertTriangle, MapPin, Wifi, WifiOff,
  Clock, XCircle, Navigation, CheckCircle, ChevronDown,
} from 'lucide-react';
import apiClient from '../../api/client';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { canTriggerSOS, hasPendingLocation } from '../../utils/citizenCommunities';
import { SEVERITY_TO_INT } from '../../utils/sos';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import { useAuthUserId } from '../../store/authStore';
import type { SOSBatchLocationItem, SOSLiveStateDto } from '../../types';

const HOLD_MS         = 3000;
const TICK_MS         = 50;
const RING_RADIUS     = 90;
const CIRCUMFERENCE   = 2 * Math.PI * RING_RADIUS;

type ActiveSOS = {
  id: string;
  communityId: string;
  severity: string;
  affectedCommunityIds?: string[];
};

function acquirePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err = new Error('Geolocation not supported') as any;
      err.code = 2;
      reject(err);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout:    10_000,
      maximumAge: 60_000,
    });
  });
}

export default function SOS() {
  const { t } = useTranslation(); // 👈 تفعيل الترجمة
  
  // 👈 نقلت مصفوفة الـ SEVERITIES جوه الكومبوننت عشان تستخدم الترجمة براحتها
  const SEVERITIES = [
    { value: 'Standard', label: t('sos.severities.Standard', 'Standard'),      color: 'from-orange-600 to-red-600', glow: 'shadow-orange-500/40' },
    { value: 'High',     label: t('sos.severities.High', 'High Priority'),     color: 'from-red-600 to-red-700',   glow: 'shadow-red-500/50'   },
    { value: 'Critical', label: t('sos.severities.Critical', 'Critical !!!'),  color: 'from-red-700 to-rose-800',  glow: 'shadow-rose-600/60'  },
  ] as const;

  const addToast        = useNotificationStore((s) => s.addToast);
  const { isConnected } = useSignalR();
  const userId          = useAuthUserId();

  const [severity,            setSeverity]            = useState<string>('Standard');
  const [message,             setMessage]             = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [gpsError,            setGpsError]            = useState<string | null>(null);

  const [loading,     setLoading]     = useState(false);
  const [activeSOS,   setActiveSOS]   = useState<ActiveSOS | null>(null);

  const { data: myActiveAlert, isFetched: myActiveFetched } = useQuery({
    queryKey: ['sos', 'my-active'],
    queryFn:  async () => {
      try {
        const r = await apiClient.get('/api/SOSAlerts/my-active');
        return r.data;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
    retry:     false,
    staleTime: 0,
  });
  const [pingCount,   setPingCount]   = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isStale,     setIsStale]     = useState(false);
  const [isOnline,    setIsOnline]    = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const [holdProgress,  setHoldProgress]  = useState(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didFireRef      = useRef(false);

  const locationQueue = useRef<SOSBatchLocationItem[]>([]);
  const watchIdRef    = useRef<number | null>(null);

  const { data: communities = [] } = useQuery({
    queryKey: communityKeys.myList(),
    queryFn:  () => communityApi.getMyCommunities(userId),
  });

  const triggerableCommunities = communities.filter(canTriggerSOS);
  const hasActiveMembership    = triggerableCommunities.length > 0;
  const hasPendingMembership   = communities.some(hasPendingLocation);

  useEffect(() => {
    if (triggerableCommunities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(triggerableCommunities[0].id);
    }
  }, [triggerableCommunities.length]);

  useEffect(() => {
    if (!myActiveFetched || !myActiveAlert?.id) return;
    setActiveSOS((current) => {
      if (current) return current;
      return {
        id:                   myActiveAlert.id ?? myActiveAlert.sosAlertId,
        communityId:          myActiveAlert.communityId,
        severity:             myActiveAlert.severity ?? 'Standard',
        affectedCommunityIds: (myActiveAlert.affectedCommunityIds?.length ?? 0) > 0
          ? myActiveAlert.affectedCommunityIds
          : undefined,
      };
    });
  }, [myActiveFetched, myActiveAlert]);

  const selectedCommunity =
    triggerableCommunities.find((c) => c.id === selectedCommunityId)
    ?? triggerableCommunities[0];

  const { data: liveState } = useQuery<SOSLiveStateDto>({
    queryKey:        ['sos', activeSOS?.id, 'live-state'],
    queryFn:         () =>
      apiClient.get(`/api/sosalerts/${activeSOS!.id}/live-state`).then((r) => r.data),
    enabled:         !!activeSOS?.id,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (liveState) setIsStale(liveState.isInitiatorLocationStale);
  }, [liveState]);

  const enqueueLocation = useCallback((payload: SOSBatchLocationItem) => {
    locationQueue.current = [...locationQueue.current, payload].slice(-50);
    setQueuedCount(locationQueue.current.length);
  }, []);

  const sendLocation = useCallback(async (sosId: string, pos: GeolocationPosition) => {
    const payload: SOSBatchLocationItem = {
      latitude:       pos.coords.latitude,
      longitude:      pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy  ?? undefined,
      altitudeMeters: pos.coords.altitude  ?? undefined,
      recordedAtUtc:  new Date().toISOString(),
    };
    if (!navigator.onLine) { enqueueLocation(payload); return; }
    try {
      await apiClient.post(`/api/sosalerts/${sosId}/location`, payload);
      setPingCount((n) => n + 1);
      setIsStale(false);
    } catch {
      enqueueLocation(payload);
    }
  }, [enqueueLocation]);

  const flushQueue = useCallback(async (sosId: string) => {
    if (!locationQueue.current.length || !navigator.onLine) return;
    const batch = [...locationQueue.current];
    locationQueue.current = [];
    setQueuedCount(0);
    try {
      await apiClient.post(`/api/sosalerts/${sosId}/locations/batch`, { locations: batch });
      setPingCount((n) => n + batch.length);
    } catch {
      locationQueue.current = [...batch, ...locationQueue.current].slice(-50);
      setQueuedCount(locationQueue.current.length);
    }
  }, []);

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  if (activeSOS) flushQueue(activeSOS.id); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [activeSOS, flushQueue]);

  useEffect(() => { if (activeSOS)              flushQueue(activeSOS.id); }, [activeSOS,   flushQueue]);
  useEffect(() => { if (isConnected && activeSOS) flushQueue(activeSOS.id); }, [isConnected, activeSOS, flushQueue]);

  const startTracking = useCallback((sosId: string) => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(sosId, pos),
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  }, [sendLocation]);

  useEffect(() => {
    if (!activeSOS?.id || watchIdRef.current !== null) return;
    startTracking(activeSOS.id);
  }, [activeSOS?.id, startTracking]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    locationQueue.current = [];
    setQueuedCount(0);
  }, []);

  const triggerSOS = useCallback(async () => {
    if (!selectedCommunity || loading) return;
    setLoading(true);
    setGpsError(null);

    let pos: GeolocationPosition;
    try {
      pos = await acquirePosition();
    } catch (err: any) {
      setGpsError(
        err?.code === 1
          ? t('sos.location_denied', 'You must enable Location Services to use SOS.')
          : t('sos.location_failed', 'Could not determine your location. Please enable GPS and try again.')
      );
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.post('/api/sosalerts/trigger', {
        severity:       SEVERITY_TO_INT[severity] ?? 0,
        message:        message.trim() || undefined,
        communityId:    selectedCommunity.id,
        latitude:       pos.coords.latitude,
        longitude:      pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy ?? undefined,
      });
      const alert    = res.data;
      const sosId    = alert.id ?? alert.sosAlertId;
      const affected = (alert.affectedCommunityIds ?? alert.AffectedCommunityIds ?? []) as string[];
      setActiveSOS({
        id:                   sosId,
        communityId:          selectedCommunity.id,
        severity,
        affectedCommunityIds: affected.length > 0 ? affected : undefined,
      });
      startTracking(sosId);
      setPingCount(0);
      addToast({ type: 'sos', title: '🚨 SOS Triggered', description: 'Help is on the way. Stay calm.', severity });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        addToast({
          type:        'warning',
          title:       'Active Alert Exists',
          description: 'You already have an active SOS alert.',
        });
      } else {
        addToast({
          type:        'error',
          title:       'SOS Failed',
          description: e?.response?.data?.message ?? 'Could not trigger SOS.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCommunity, loading, severity, message, startTracking, addToast, t]);

  const startHold = useCallback(() => {
    if (!selectedCommunity || loading) return;
    didFireRef.current = false;
    const startMs = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const progress = Math.min(100, ((Date.now() - startMs) / HOLD_MS) * 100);
      setHoldProgress(progress);
      if (progress >= 100 && !didFireRef.current) {
        didFireRef.current = true;
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        setHoldProgress(0);
        triggerSOS();
      }
    }, TICK_MS);
  }, [selectedCommunity, loading, triggerSOS]);

  const stopHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
    didFireRef.current = false;
  }, []);

  const cancelSOS = async () => {
    if (!activeSOS) return;
    try {
      await apiClient.put(`/api/sosalerts/${activeSOS.id}/cancel`);
      stopTracking();
      setActiveSOS(null);
      setPingCount(0);
      setIsStale(false);
      addToast({ type: 'info', title: 'SOS Cancelled', description: 'Your alert has been cancelled.' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Cancel Failed', description: e?.response?.data?.message ?? 'Could not cancel.' });
    }
  };

  useEffect(() => () => {
    stopTracking();
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  }, [stopTracking]);

  // ════════════════════════════════════════════════════════════════════
  // ACTIVE SOS SCREEN
  // ════════════════════════════════════════════════════════════════════
  if (activeSOS) {
    const sevColor = SEVERITIES.find((s) => s.value === activeSOS.severity)?.color ?? SEVERITIES[0].color;
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="relative flex items-center justify-center mb-8">
            <div className={`absolute w-52 h-52 rounded-full bg-gradient-to-br ${sevColor} opacity-20 animate-ping`} />
            <div className={`absolute w-44 h-44 rounded-full bg-gradient-to-br ${sevColor} opacity-30 animate-pulse`} />
            <div className={`relative w-36 h-36 rounded-full bg-gradient-to-br ${sevColor} flex flex-col items-center justify-center shadow-2xl`}>
              <Siren className="w-10 h-10 text-white" />
              <p className="text-white text-xs font-bold mt-1">{t('sos.active', 'ACTIVE')}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">{t('sos.active_title', 'SOS Active')}</h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                activeSOS.severity === 'Critical'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : activeSOS.severity === 'High'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}>
                {t(`sos.severities.${activeSOS.severity}`, activeSOS.severity)}
              </span>
            </div>

            {(activeSOS.affectedCommunityIds?.length ?? 0) > 1 && (
              <p className="text-xs text-indigo-300">
                {t('sos.alerted_communities', 'Alerted {{count}} communities').replace('{{count}}', String(activeSOS.affectedCommunityIds!.length))}
              </p>
            )}

            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              isStale
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            }`}>
              {isStale
                ? <WifiOff className="w-3.5 h-3.5" />
                : <Navigation className="w-3.5 h-3.5 animate-pulse" />}
              {isStale
                ? t('sos.signal_lost', 'Location signal lost')
                : t('sos.broadcasting', 'Broadcasting location · {{count}} pings sent').replace('{{count}}', String(pingCount))}
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {!isOnline
                ? t('sos.offline_queued', 'Offline — {{count}} locations queued').replace('{{count}}', String(queuedCount))
                : queuedCount > 0
                  ? t('sos.retrying', 'Retrying {{count}} queued locations…').replace('{{count}}', String(queuedCount))
                  : isConnected
                    ? t('sos.gps_connected', 'GPS sending · live hub connected')
                    : t('sos.gps_reconnecting', 'GPS sending · hub reconnecting')}
            </div>

            {liveState && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                {t('sos.active_members', '{{count}} active community members').replace('{{count}}', String(liveState.totalActiveMembers))}
              </div>
            )}

            <button
              onClick={cancelSOS}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" /> {t('sos.cancel_alert', 'Cancel Alert')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // PRE-TRIGGER SCREEN
  // ════════════════════════════════════════════════════════════════════
  const canTrigger = hasActiveMembership && !!selectedCommunity && !loading;
  const sevConfig  = SEVERITIES.find((s) => s.value === severity) ?? SEVERITIES[0];

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-3xl font-black text-white">{t('sos.title', 'Emergency SOS')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('sos.subtitle', 'Only use in genuine emergencies')}</p>
        </div>

        {hasPendingMembership && !hasActiveMembership && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-start">
              <p className="text-sm font-bold text-amber-300">{t('sos.location_required', 'Location Required')}</p>
              <p className="text-xs text-amber-400/80 mt-1">
                {t('sos.pending_location', 'Your community membership is pending location verification. Share your location in Communities to activate SOS.')}
              </p>
            </div>
          </div>
        )}

        {communities.length === 0 && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-gray-800 border border-gray-700">
            <AlertTriangle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-start">
              <p className="text-sm font-bold text-gray-300">{t('sos.no_community', 'No Community Joined')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('sos.join_to_use', 'Join a community to use the SOS feature.')}</p>
            </div>
          </div>
        )}

        {gpsError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30">
            <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-red-300 text-start">{gpsError}</p>
          </div>
        )}

        {triggerableCommunities.length > 0 && (
          <div className="text-start">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('sos.broadcast_to', 'Broadcast To')}</label>
            <div className="relative">
              <select
                value={selectedCommunityId}
                onChange={(e) => setSelectedCommunityId(e.target.value)}
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pe-9 text-sm text-white outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                {triggerableCommunities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="text-start">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('sos.severity', 'Severity')}</label>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSeverity(s.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                  severity === s.value
                    ? `bg-gradient-to-br ${s.color} text-white border-transparent shadow-lg ${s.glow}`
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('sos.desc_placeholder', 'Optional: Describe your emergency…')}
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-red-500 resize-none transition-colors text-start"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg
              className="absolute inset-0 -rotate-90 pointer-events-none"
              viewBox="0 0 192 192"
              aria-hidden="true"
            >
              <circle cx="96" cy="96" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              {holdProgress > 0 && (
                <circle
                  cx="96" cy="96" r={RING_RADIUS} fill="none"
                  stroke="rgba(255,255,255,0.85)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - holdProgress / 100)}
                />
              )}
            </svg>

            <button
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(); }}
              onTouchEnd={stopHold}
              onTouchCancel={stopHold}
              disabled={!canTrigger}
              aria-label="Hold for 3 seconds to trigger SOS"
              className={`relative w-40 h-40 rounded-full text-white font-black select-none
                bg-gradient-to-br ${sevConfig.color} shadow-2xl ${sevConfig.glow}
                transition-transform duration-75
                disabled:opacity-40 disabled:cursor-not-allowed
                ${holdProgress > 0 ? 'scale-95' : canTrigger ? 'hover:scale-105' : ''}
              `}
            >
              {loading ? (
                <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                <div className="flex flex-col items-center">
                  <Siren className="w-12 h-12 mx-auto" />
                  <p className="text-sm mt-1">SOS</p>
                </div>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-600 text-center h-4">
            {canTrigger
              ? holdProgress > 0
                ? t('sos.keep_holding', 'Keep holding…')
                : t('sos.hold_to_trigger', 'Hold for 3 seconds to trigger')
              : !hasActiveMembership
                ? t('sos.join_active', 'Join an active community to use SOS')
                : ''}
          </p>
        </div>

        <div className="flex justify-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{t('sos.gps_tracked', 'GPS tracked')}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t('sos.real_time', 'Real-time')}</span>
          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{t('sos.offline_safe', 'Offline safe')}</span>
        </div>
      </div>
    </div>
  );
}