import {
  useEffect, useRef, useCallback, useState, useReducer,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  Wifi, WifiOff, MapPin, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, Radio,
} from 'lucide-react';
import { differenceInSeconds, differenceInMinutes } from 'date-fns';
import apiClient from '../../api/client';
import MediaImage from '../../components/MediaImage';
import { fetchSOSLocationHistory, useSOSAlerts } from '../../api/sos';
import { useSignalR } from '../../providers/SignalRProvider';
import { useCommunityNameMap, resolveCommunityName } from '../../hooks/useCommunityNameMap';
import { normalizeStatus, normalizeSeverity, SEVERITY_TO_INT } from '../../utils/sos';
import { resolveLastKnownLocation, unwrapApiPayload } from '../../utils/sosLocation';
import {
  getTrackingStatus,
  getTrackingBadgeLabel,
  hasIncidentLocationData,
  shouldShowLastPingText,
  shouldShowNoPingsMessage,
  isStaleForDisplay,
} from '../../utils/sosTrackingStatus';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import SOSLiveMap from '../../components/Map/SOSLiveMap';
import SeveritySelector from '../../components/SeveritySelector';
import SOSDetailModal from '../../components/SOS/SOSDetailModal';
import SOSBroadcastLabel from '../../components/SOS/SOSBroadcastLabel';
import { useNotificationStore } from '../../store/notificationStore';
import type {
  SOSAlertListItem, SOSLocationDto,
  SOSSeverity, ActiveSOSCardState, SOSLiveStateDto,
} from '../../types';

// ─── Audio ─────────────────────────────────────────────────────────────────
function playAlertSound(severity?: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (f: number, t: number, d: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d);
    };
    const now = ctx.currentTime;
    if (severity === 'Critical') {
      beep(880, now, 0.15, 'square');
      beep(1100, now + 0.2, 0.15, 'square');
      beep(880, now + 0.4, 0.2, 'square');
    } else {
      beep(660, now, 0.12);
      beep(880, now + 0.18, 0.18);
    }
  } catch { /* noop — browser may block until user gesture */ }
}

// ─── Per-card state reducer ──────────────────────────────────────────────────
type CardAction =
  | { type: 'INIT'; id: string; state: ActiveSOSCardState }
  | { type: 'LOCATION_PING'; id: string; loc: SOSLocationDto }
  | { type: 'HISTORY_LOADED'; id: string; history: SOSLocationDto[] }
  | { type: 'TICK' }  // every second: increment lastPingAgeSeconds
  | { type: 'SEVERITY_CHANGED'; id: string; severity: SOSSeverity }
  | { type: 'SET_STALE'; id: string }
  | { type: 'SET_HEALTHY'; id: string }
  | { type: 'USER_PANNED'; id: string }
  | { type: 'RECENTER'; id: string };

type CardStates = Record<string, ActiveSOSCardState>;

function cardReducer(state: CardStates, action: CardAction): CardStates {
  switch (action.type) {
    case 'INIT':
      if (state[action.id]) return state;
      return { ...state, [action.id]: action.state };
    case 'LOCATION_PING': {
      const prev = state[action.id];
      if (!prev) return state;
      const loc = action.loc;
      const merged = dedupeAndSort([...prev.locationHistory, loc]);
      return {
        ...state,
        [action.id]: {
          ...prev,
          locationHistory: merged,
          latestLocation: loc,
          totalPingsReceived: prev.totalPingsReceived + 1,
          lastPingAt: loc.recordedAtUtc,
          lastPingAgeSeconds: 0,
          isLocationStale: false,
        },
      };
    }
    case 'HISTORY_LOADED': {
      const prev = state[action.id];
      if (!prev) return state;
      const merged = dedupeAndSort([...prev.locationHistory, ...action.history]);
      const latest = merged.length > 0 ? merged[merged.length - 1] : prev.latestLocation;
      return {
        ...state,
        [action.id]: {
          ...prev,
          locationHistory: merged,
          latestLocation: latest,
          totalPingsReceived: Math.max(prev.totalPingsReceived, merged.length),
          lastPingAt: latest?.recordedAtUtc ?? prev.lastPingAt,
          lastPingAgeSeconds: latest
            ? differenceInSeconds(new Date(), new Date(latest.recordedAtUtc))
            : prev.lastPingAgeSeconds,
          isLocationStale: latest
            ? differenceInSeconds(new Date(), new Date(latest.recordedAtUtc)) > 90
            : prev.isLocationStale,
        },
      };
    }
    case 'TICK': {
      const next: CardStates = {};
      for (const [id, card] of Object.entries(state)) {
        if (card.totalPingsReceived === 0 && card.locationHistory.length === 0) {
          next[id] = { ...card, lastPingAgeSeconds: 0, isLocationStale: false };
          continue;
        }
        const age = card.lastPingAt
          ? differenceInSeconds(new Date(), new Date(card.lastPingAt))
          : card.lastPingAgeSeconds + 1;
        next[id] = {
          ...card,
          lastPingAgeSeconds: age,
          isLocationStale: age > 90,
        };
      }
      return next;
    }
    case 'SEVERITY_CHANGED':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], currentSeverity: action.severity } };
    case 'SET_STALE':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], isLocationStale: true } };
    case 'SET_HEALTHY':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], isLocationStale: false, lastPingAgeSeconds: 0 } };
    case 'USER_PANNED':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], userHasPanned: true } };
    case 'RECENTER':
      if (!state[action.id]) return state;
      return { ...state, [action.id]: { ...state[action.id], userHasPanned: false } };
    default:
      return state;
  }
}

function dedupeAndSort(locs: SOSLocationDto[]): SOSLocationDto[] {
  const seen = new Set<string>();
  return locs
    .filter((l) => {
      const key = l.recordedAtUtc;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.recordedAtUtc).getTime() - new Date(b.recordedAtUtc).getTime());
}

// ─── Single tracking-status badge (mutually exclusive states) ────────────────
function TrackingStatusChip({
  totalLocationUpdates,
  locationHistoryLength,
  isLocationStale,
  ageSeconds,
}: {
  totalLocationUpdates: number;
  locationHistoryLength: number;
  isLocationStale: boolean;
  ageSeconds: number;
}) {
  const { t } = useTranslation();
  const status = getTrackingStatus({ totalLocationUpdates, locationHistoryLength, isLocationStale });
  const label = getTrackingBadgeLabel(status); // English default from utils, consider wrapping in t() there or mapping here
  const transLabel = t(`authority_sos.${label.toLowerCase()}`, label);

  if (status === 'waiting') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Radio className="w-2.5 h-2.5" /> {transLabel}
      </span>
    );
  }
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {transLabel} · {ageSeconds < 60 ? t('authority_sos.ago_seconds', '{{s}}s ago').replace('{{s}}', String(ageSeconds)) : t('authority_sos.ago_minutes', '{{m}}m ago').replace('{{m}}', String(Math.floor(ageSeconds / 60)))}
      </span>
    );
  }
  const mins = Math.floor(ageSeconds / 60);
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
      ⚠ {transLabel}
      {ageSeconds > 0 && ` · ${mins > 0 ? t('authority_sos.ago_minutes', '{{m}}m ago').replace('{{m}}', String(mins)) : t('authority_sos.ago_seconds', '{{s}}s ago').replace('{{s}}', String(ageSeconds))}`}
    </span>
  );
}

// ─── Elapsed time counter ────────────────────────────────────────────────────
function ElapsedMinutes({ createdAtUtc }: { createdAtUtc: string }) {
  const [mins, setMins] = useState(() => differenceInMinutes(new Date(), new Date(createdAtUtc)));

  useEffect(() => {
    const id = setInterval(() => {
      setMins(differenceInMinutes(new Date(), new Date(createdAtUtc)));
    }, 60_000);
    return () => clearInterval(id);
  }, [createdAtUtc]);

  return <span className="text-white font-semibold tabular-nums" dir="ltr">{mins}m</span>;
}

// ─── SOSCard ─────────────────────────────────────────────────────────────────
function SOSCard({
  alert,
  cardState,
  communityNameMap,
  onAction,
  onOpenDetail,
  onPanned,
  onRecenter,
  recenterNonce,
  isReconnecting,
  isPending,
}: {
  alert: SOSAlertListItem;
  cardState: ActiveSOSCardState | null;
  communityNameMap: Map<string, string>;
  onAction: (action: string, payload?: string) => void;
  onOpenDetail: () => void;
  onPanned: () => void;
  onRecenter: () => void;
  recenterNonce: number;
  isReconnecting: boolean;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const { data: alertDetail } = useQuery<any>({
    queryKey: ['sos', alert.id, 'detail'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/sosalerts/${alert.id}`);
      const d = unwrapApiPayload<any>(res.data);
      return {
        ...d,
        status: normalizeStatus(d.status),
        severity: normalizeSeverity(d.severity),
      };
    },
    staleTime: Infinity,
  });

  const { data: liveState } = useQuery<SOSLiveStateDto>({
    queryKey: ['sos', alert.id, 'live-state'],
    queryFn: () =>
      apiClient.get(`/api/sosalerts/${alert.id}/live-state`).then((r) => {
        const d = r.data;
        return {
          ...d,
          status: normalizeStatus(d.status),
          severity: normalizeSeverity(d.severity),
        };
      }),
    staleTime: 30_000,
  });

  const severity = cardState?.currentSeverity ?? normalizeSeverity(alert.severity);
  const isCritical = severity === 'Critical';
  const isHigh = severity === 'High';
  const locationHistory = cardState?.locationHistory ?? [];
  const totalPings = Math.max(
    cardState?.totalPingsReceived ?? alert.totalLocationUpdates,
    locationHistory.length > 0 ? 1 : 0,
  );
  const trackingInput = {
    totalLocationUpdates: totalPings,
    locationHistoryLength: locationHistory.length,
    isLocationStale: cardState?.isLocationStale ?? alert.isLocationStale,
  };
  const showStale = isStaleForDisplay(trackingInput);
  const ageSeconds = shouldShowLastPingText(trackingInput)
    ? (cardState?.lastPingAgeSeconds ??
        (alert.lastLocationPingAt
          ? differenceInSeconds(new Date(), new Date(alert.lastLocationPingAt))
          : 0))
    : 0;
  const latestLocation = cardState?.latestLocation ?? null;
  const accuracy = latestLocation?.accuracyMeters ?? null;
  const incidentHasLocation = hasIncidentLocationData(totalPings, locationHistory.length);

  const rawCommunityName = cardState?.communityName ?? 'Unknown Community';
  const communityName = rawCommunityName;
  const showCommunityIdFallback = rawCommunityName === 'Unknown Community';

  const reporter = alertDetail?.reporter;
  const lastKnownLocation = resolveLastKnownLocation(
    reporter,
    alertDetail?.recentLocations,
    liveState ?? null,
  );
  const initiatorName =
    liveState?.initiatorName ??
    reporter?.fullName ??
    null;
  const displayName = initiatorName ?? (alert.initiatorUserId.slice(0, 8) + '…');

  const borderClass = showStale
    ? 'border-amber-500/50 border-dashed'
    : isCritical
      ? 'border-red-500 shadow-lg shadow-red-900/20 animate-[pulse_3s_ease-in-out_infinite]'
      : isHigh
        ? 'border-orange-500/70 shadow-md shadow-orange-900/10'
        : 'border-gray-800';

  const severityBadgeClass = isCritical
    ? 'bg-red-600 animate-pulse'
    : isHigh
      ? 'bg-orange-500'
      : 'bg-yellow-500';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetail(); }}
      className={`bg-gray-900 rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all duration-300 cursor-pointer hover:border-indigo-500/40 text-start ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold text-white ${severityBadgeClass}`}>
            {t(`severity.${severity.toLowerCase()}`, severity)}
          </span>
          <div className="flex flex-col">
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-gray-800/50 text-gray-300 border border-gray-600">
              {communityName}
            </span>
            {showCommunityIdFallback && (
              <span className="text-[9px] text-gray-600 ps-3 mt-0.5 font-mono" dir="ltr">
                {t('authority_sos.community_id', 'Community ID: …{{id}}').replace('{{id}}', alert.communityId.slice(-8))}
              </span>
            )}
            <SOSBroadcastLabel
              communityId={alert.communityId}
              affectedCommunityIds={alertDetail?.affectedCommunityIds ?? alert.affectedCommunityIds}
              nameMap={communityNameMap}
              className="text-[10px] text-indigo-400 ps-3 mt-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ms-auto">
          <TrackingStatusChip
            totalLocationUpdates={totalPings}
            locationHistoryLength={locationHistory.length}
            isLocationStale={trackingInput.isLocationStale}
            ageSeconds={ageSeconds}
          />
          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
            {t('authority_sos.active_mins', 'Active {{m}}').replace('{{m}}', '')} <ElapsedMinutes createdAtUtc={alert.createdAtUtc} />
          </span>
        </div>
      </div>

      {isReconnecting && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          {t('authority_sos.reconnecting_banner', 'Reconnecting — polling live-state every 15s')}
        </div>
      )}

      {alert.message && (
        <p className="text-white font-medium text-sm leading-snug">{alert.message}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 bg-gray-800/50 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {reporter?.profilePhotoUrl ? (
            <MediaImage
              src={reporter.profilePhotoUrl}
              alt={displayName}
              className="w-4 h-4 rounded-full object-cover border border-gray-700"
            />
          ) : null}
          <span className="text-gray-600">{t('authority_sos.initiator', 'Initiator:')}</span>
          <span className="text-gray-200 font-medium">{displayName}</span>
        </div>

        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-gray-500" />
          {shouldShowNoPingsMessage(trackingInput) ? (
            <span className="text-amber-400 font-semibold">{t('authority_sos.no_pings', 'No pings — GPS may be unavailable')}</span>
          ) : (
            <span className="text-gray-300 font-medium" dir="ltr">📡 {totalPings} {t('authority_sos.pings', 'pings')}</span>
          )}
        </div>

        {shouldShowLastPingText(trackingInput) && ageSeconds >= 0 && (
          <div className="flex items-center gap-1">
            <span className="text-gray-600">⏱ {t('authority_sos.last_ping', 'Last ping:')}</span>
            <span className={showStale ? 'text-amber-400' : 'text-gray-400'} dir="ltr">
              {ageSeconds < 60 ? t('authority_sos.ago_seconds', '{{s}}s ago').replace('{{s}}', String(ageSeconds)) : t('authority_sos.ago_minutes', '{{m}}m ago').replace('{{m}}', String(Math.floor(ageSeconds / 60)))}
            </span>
          </div>
        )}

        {accuracy !== null && accuracy > 0 && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            <span className="text-gray-300" dir="ltr">±{Math.round(accuracy)}m</span>
          </div>
        )}

        {latestLocation ? (
          <span className={`font-mono text-[10px] ${showStale ? 'text-amber-400/70' : 'text-gray-500'}`} dir="ltr">
            {latestLocation.latitude.toFixed(5)}, {latestLocation.longitude.toFixed(5)}
          </span>
        ) : lastKnownLocation && !incidentHasLocation ? (
          <span className="font-mono text-[10px] text-gray-500" dir="ltr">
            {t('authority_sos.last_location', 'Last:')} {lastKnownLocation.lat.toFixed(5)}, {lastKnownLocation.lng.toFixed(5)}
          </span>
        ) : null}
      </div>

      {liveState && liveState.memberLocations.length > 0 && (
        <div className="text-xs text-gray-400 bg-gray-800/30 rounded-xl px-3 py-2">
          👥 {liveState.totalActiveMembers} {t('authority_sos.members_active', 'members active')} ·{' '}
          ⚠ {liveState.totalStaleMembers} {t('authority_sos.stale', 'stale')} ·{' '}
          ⏳ {liveState.totalLocationPendingMembers} {t('authority_sos.pending', 'pending')}
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <SOSLiveMap
          sosId={alert.id}
          locationHistory={locationHistory}
          latestLocation={latestLocation}
          lastPingAgeSeconds={ageSeconds}
          userHasPanned={cardState?.userHasPanned ?? false}
          onUserPanned={onPanned}
          onRecenter={onRecenter}
          recenterNonce={recenterNonce}
          lastKnownLocation={!incidentHasLocation ? lastKnownLocation : null}
          liveState={liveState ?? null}
          initiatorName={initiatorName}
          hasIncidentLocationData={incidentHasLocation}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" onClick={() => onOpenDetail()} variant="secondary" className="w-full text-xs">
          {t('authority_sos.view_details', 'View Details')}
        </Button>
        <Button size="sm" onClick={() => onAction('resolve')} isLoading={isPending} className="flex-1">
          <CheckCircle className="w-3.5 h-3.5 me-1" /> {t('authority_sos.resolve', 'Resolve')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('false-alarm')} isLoading={isPending} className="flex-1">
          ✗ {t('authority_sos.false_alarm', 'False Alarm')}
        </Button>
        <div className="w-full">
          <SeveritySelector current={severity} alertId={alert.id} isPending={isPending} onConfirm={(newSev) => onAction('severity', newSev)} />
        </div>
      </div>
    </div>
  );
}

const SEVERITIES = ['', 'Standard', 'High', 'Critical'] as const;
const SEV_COLORS: Record<string, string> = {
  '': 'border-gray-700 text-gray-400 hover:border-gray-500',
  Standard: 'border-yellow-500/60 text-yellow-400 hover:border-yellow-400',
  High: 'border-orange-500/60 text-orange-400 hover:border-orange-400',
  Critical: 'border-red-500/60 text-red-400 hover:border-red-400',
};
const SEV_ACTIVE: Record<string, string> = {
  '': 'bg-gray-700 border-gray-500 text-white',
  Standard: 'bg-yellow-500/20 border-yellow-400 text-yellow-300',
  High: 'bg-orange-500/20 border-orange-400 text-orange-300',
  Critical: 'bg-red-500/20 border-red-400 text-red-300',
};

// ─── Pagination ──────────────────────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
      <span className="text-sm text-gray-400 tabular-nums">
        {t('authority_sos.page', 'Page {{current}} of {{total}}').replace('{{current}}', String(currentPage)).replace('{{total}}', String(totalPages))}
      </span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function AuthoritySOS() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { connection, connectionState, joinCommunityGroup } = useSignalR();
  const addToast = useNotificationStore((s) => s.addToast);
  const communityNameMap = useCommunityNameMap();

  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailAlert, setDetailAlert] = useState<SOSAlertListItem | null>(null);
  const [recenterNonces, setRecenterNonces] = useState<Record<string, number>>({});
  const prevCritical = useRef(new Set<string>());

  const [cardStates, dispatch] = useReducer(cardReducer, {});
  const cardStatesRef = useRef(cardStates);
  cardStatesRef.current = cardStates;

  const pollingIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const lastGeneratedAt = useRef<Map<string, string>>(new Map());
  const alertCommunityGroupsJoined = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  const filters = {
    status: 'Active',
    ...(severityFilter ? { severity: severityFilter } : {}),
    page: currentPage,
    pageSize: 20,
  };

  const { data, isLoading } = useSOSAlerts(filters);
  const alerts: SOSAlertListItem[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (connectionState !== 'Connected') return;
    for (const alert of alerts) {
      if (!alertCommunityGroupsJoined.current.has(alert.communityId)) {
        joinCommunityGroup(alert.communityId);
        alertCommunityGroupsJoined.current.add(alert.communityId);
      }
    }
  }, [alerts, connectionState, joinCommunityGroup]);

  useEffect(() => {
    if (!alerts.length) return;
    const syncHistories = async () => {
      for (const alert of alerts) {
        try {
          const history = await fetchSOSLocationHistory(alert.id);
          if (history.length === 0) continue;
          dispatch({ type: 'HISTORY_LOADED', id: alert.id, history });
          queryClient.setQueryData<SOSLocationDto[]>(
            ['sos', alert.id, 'locations'],
            (old) => dedupeAndSort([...(old ?? []), ...history]),
          );
        } catch { /* noop */ }
      }
    };
    syncHistories();
    const intervalId = setInterval(syncHistories, 30_000);
    return () => clearInterval(intervalId);
  }, [alerts, queryClient]);

  const bootstrapCard = useCallback(
    async (alert: SOSAlertListItem, overrideCommunityName?: string) => {
      const id = alert.id;
      const communityName = overrideCommunityName ?? resolveCommunityName(communityNameMap, alert.communityId);
      const hasListPings = alert.totalLocationUpdates > 0;
      const initState: ActiveSOSCardState = {
        alertId: id,
        communityName,
        locationHistory: [],
        latestLocation: null,
        totalPingsReceived: alert.totalLocationUpdates,
        lastPingAt: hasListPings ? alert.lastLocationPingAt : null,
        lastPingAgeSeconds: hasListPings && alert.lastLocationPingAt
          ? differenceInSeconds(new Date(), new Date(alert.lastLocationPingAt))
          : 0,
        isLocationStale: hasListPings ? alert.isLocationStale : false,
        userHasPanned: false,
        currentSeverity: normalizeSeverity(alert.severity),
      };

      dispatch({ type: 'INIT', id, state: initState });

      try {
        const history = await fetchSOSLocationHistory(id);
        if (history.length > 0) {
          dispatch({ type: 'HISTORY_LOADED', id, history });
          queryClient.setQueryData<SOSLocationDto[]>(
            ['sos', id, 'locations'],
            (old) => dedupeAndSort([...(old ?? []), ...history])
          );
        }
      } catch { /* noop */ }
    },
    [communityNameMap, queryClient]
  );

  const bootstrappedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const alert of alerts) {
      if (!bootstrappedIds.current.has(alert.id)) {
        bootstrappedIds.current.add(alert.id);
        bootstrapCard(alert);
      } else if (cardStatesRef.current[alert.id]) {
        const resolved = communityNameMap.get(alert.communityId);
        if (resolved && cardStatesRef.current[alert.id].communityName === 'Unknown Community') {
          dispatch({
            type: 'INIT',
            id: alert.id,
            state: {
              ...cardStatesRef.current[alert.id],
              communityName: resolved,
            },
          });
        }
      }
    }
  }, [alerts, communityNameMap, bootstrapCard]);

  useEffect(() => {
    alerts.forEach((alert) => {
      if (normalizeSeverity(alert.severity) === 'Critical' && !prevCritical.current.has(alert.id)) {
        playAlertSound('Critical');
        prevCritical.current.add(alert.id);
      }
    });
  }, [alerts]);

  const startPolling = useCallback(
    (alertId: string) => {
      if (pollingIntervals.current.has(alertId)) return;
      const id = setInterval(async () => {
        try {
          const lsRes = await apiClient.get<SOSLiveStateDto>(`/api/sosalerts/${alertId}/live-state`);
          const ls = lsRes.data;
          const prevGen = lastGeneratedAt.current.get(alertId);
          if (prevGen && ls.generatedAt === prevGen) return;
          lastGeneratedAt.current.set(alertId, ls.generatedAt);

          queryClient.setQueryData(['sos', alertId, 'live-state'], ls);

          const card = cardStatesRef.current[alertId];
          const hasData = card && hasIncidentLocationData(card.totalPingsReceived, card.locationHistory.length);
          if (hasData && ls.initiatorLatitude && ls.initiatorLatitude !== 0) {
            const syntheticLoc: SOSLocationDto = {
              latitude: ls.initiatorLatitude,
              longitude: ls.initiatorLongitude,
              accuracyMeters: null,
              altitudeMeters: null,
              recordedAtUtc: ls.initiatorLastPingAt ?? new Date().toISOString(),
              locationName: null,
            };
            dispatch({ type: 'LOCATION_PING', id: alertId, loc: syntheticLoc });
          }
        } catch { /* noop */ }
      }, 15_000);
      pollingIntervals.current.set(alertId, id);
    },
    [queryClient]
  );

  const stopAllPolling = useCallback(() => {
    for (const id of pollingIntervals.current.values()) clearInterval(id);
    pollingIntervals.current.clear();
  }, []);

  useEffect(() => {
    if (!connection) return;

    const onTriggered = (_communityId: string, alert: any) => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      if (alert.communityId) {
        joinCommunityGroup(alert.communityId);
        alertCommunityGroupsJoined.current.add(alert.communityId);
      }
      const normalized = {
        ...alert,
        status: normalizeStatus(alert.status),
        severity: normalizeSeverity(alert.severity),
      };
      queryClient.setQueryData(['sos', alert.id], normalized);
      const communityName = resolveCommunityName(communityNameMap, alert.communityId);
      const sev = normalized.severity as SOSSeverity;
      addToast({
        type: 'sos',
        title: t('authority_sos.toast_new_sos', 'New SOS Alert'),
        description: alert.message ?? undefined,
        communityName,
        severity: sev,
        actionLink: '/authority/sos',
      });
      if (sev === 'Critical') playAlertSound('Critical');
    };

    const onResolved = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onCancelled = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
    const onFalseAlarm = () => queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });

    const onLocation = (sosAlertId: string, loc: SOSLocationDto) => {
      dispatch({ type: 'LOCATION_PING', id: sosAlertId, loc });
      queryClient.setQueryData<SOSLocationDto[]>(
        ['sos', sosAlertId, 'locations'],
        (old) => dedupeAndSort([...(old ?? []), loc])
      );
    };

    const onSeverityChanged = (sosAlertId: string, newSeverity: string) => {
      const sev = normalizeSeverity(newSeverity);
      dispatch({ type: 'SEVERITY_CHANGED', id: sosAlertId, severity: sev });
      queryClient.invalidateQueries({ queryKey: ['sos', sosAlertId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      if (sev === 'Critical') {
        playAlertSound('Critical');
        addToast({ type: 'warning', title: t('authority_sos.toast_escalated', '⚠ SOS escalated to Critical'), description: t('authority_sos.toast_escalated_desc', 'Severity updated by authority.') });
      }
    };

    const onStale = (sosAlertId: string, secondsSinceLastPing: number) => {
      dispatch({ type: 'SET_STALE', id: sosAlertId });
      const alert = alerts.find((a) => a.id === sosAlertId);
      addToast({
        type: 'warning',
        title: t('authority_sos.toast_signal_lost', '⚠ Location signal lost'),
        description: t('authority_sos.toast_signal_lost_desc', 'SOS in {{community}} — no ping for {{seconds}}s.').replace('{{community}}', alert ? (communityNameMap.get(alert.communityId) ?? 'a community') : '').replace('{{seconds}}', String(Math.round(secondsSinceLastPing))),
      });
    };

    const onRestored = (sosAlertId: string) => {
      dispatch({ type: 'SET_HEALTHY', id: sosAlertId });
      addToast({ type: 'success', title: t('authority_sos.toast_signal_restored', '✓ Location signal restored') });
    };

    const onMemberActivated = (_sosAlertId: string, _userId: string, memberName: string) => {
      addToast({ type: 'info', title: `${memberName} ${t('authority_sos.toast_member_tracking', 'is now tracking this SOS')}` });
    };

    const onDisconnect = () => {
      for (const alertId of Object.keys(cardStatesRef.current)) startPolling(alertId);
      addToast({ type: 'warning', title: t('authority_sos.toast_live_paused', '⚠ Live updates paused — using polling fallback') });
    };

    const onReconnect = () => {
      stopAllPolling();
      lastGeneratedAt.current.clear();
      addToast({ type: 'success', title: t('authority_sos.toast_live_restored', '✓ Live updates restored') });
      for (const alert of alerts) {
        queryClient.invalidateQueries({ queryKey: ['sos', alert.id, 'live-state'] });
        bootstrapCard(alert);
      }
    };

    connection.on('ReceiveSOSTriggered', onTriggered);
    connection.on('ReceiveSOSResolved', onResolved);
    connection.on('ReceiveSOSCancelled', onCancelled);
    connection.on('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
    connection.on('ReceiveLocationUpdate', onLocation);
    connection.on('ReceiveSeverityChanged', onSeverityChanged);
    connection.on('ReceiveLocationStale', onStale);
    connection.on('ReceiveLocationRestored', onRestored);
    connection.on('ReceiveSOSMemberActivated', onMemberActivated);
    connection.onclose(onDisconnect);
    connection.onreconnected(onReconnect);

    return () => {
      connection.off('ReceiveSOSTriggered', onTriggered);
      connection.off('ReceiveSOSResolved', onResolved);
      connection.off('ReceiveSOSCancelled', onCancelled);
      connection.off('ReceiveSOSMarkedAsFalseAlarm', onFalseAlarm);
      connection.off('ReceiveLocationUpdate', onLocation);
      connection.off('ReceiveSeverityChanged', onSeverityChanged);
      connection.off('ReceiveLocationStale', onStale);
      connection.off('ReceiveLocationRestored', onRestored);
      connection.off('ReceiveSOSMemberActivated', onMemberActivated);
    };
  }, [connection, queryClient, addToast, communityNameMap, alerts, startPolling, stopAllPolling, bootstrapCard, t]);

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: string; payload?: string }) => {
      if (action === 'severity') {
        const sevInt = SEVERITY_TO_INT[payload ?? 'Standard'] ?? 0;
        const res = await apiClient.put(`/api/sosalerts/${id}/severity`, { severity: sevInt });
        return { action, id, responseData: res.data };
      } else {
        await apiClient.put(`/api/sosalerts/${id}/${action}`, {});
        return { action, id, responseData: null };
      }
    },
    onSuccess: (result: { action: string; id: string; responseData: any }) => {
      if (result.action === 'severity' && result.responseData) {
        const confirmedSev = normalizeSeverity(result.responseData.severity);
        dispatch({ type: 'SEVERITY_CHANGED', id: result.id, severity: confirmedSev });
      }
      if (result.action === 'resolve' || result.action === 'false-alarm') {
        setDetailAlert(null);
      }
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      addToast({ type: 'success', title: t('authority_sos.toast_sos_updated', 'SOS Alert Updated') });
    },
    onError: () => addToast({ type: 'error', title: t('authority_sos.toast_action_failed', 'Action Failed') }),
  });

  const handleAction = useCallback(
    (alertId: string) => (action: string, payload?: string) => {
      actionMutation.mutate({ id: alertId, action, payload });
    },
    [actionMutation]
  );

  const handleSeverityChange = (sev: string) => {
    setSeverityFilter(sev);
    setCurrentPage(1);
  };

  const staleCount = alerts.filter((a) => {
    const card = cardStates[a.id];
    const total = Math.max(a.totalLocationUpdates, card?.totalPingsReceived ?? 0);
    const histLen = card?.locationHistory.length ?? 0;
    return isStaleForDisplay({
      totalLocationUpdates: total,
      locationHistoryLength: histLen,
      isLocationStale: card?.isLocationStale ?? a.isLocationStale,
    });
  }).length;

  const getSeverityForAlert = (a: SOSAlertListItem) =>
    cardStates[a.id]?.currentSeverity ?? normalizeSeverity(a.severity);

  const isReconnecting = connectionState !== 'Connected';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-start">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{t('authority_sos.title', 'SOS Monitor')}</h1>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connectionState === 'Connected'
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse'
                : connectionState === 'Reconnecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {connectionState === 'Connected' ? (
            <><Wifi className="w-4 h-4 text-emerald-400" /> {t('authority_sos.live_updates_active', 'Live updates active')}</>
          ) : connectionState === 'Reconnecting' ? (
            <><WifiOff className="w-4 h-4 text-amber-400" /> {t('authority_sos.reconnecting_polling', 'Reconnecting… (polling active)')}</>
          ) : (
            <><WifiOff className="w-4 h-4 text-red-400" /> {t('authority_sos.disconnected_polling', 'Disconnected — polling fallback')}</>
          )}
        </div>
      </div>

      {data && data.totalCount > 0 && (
        <div className="flex flex-wrap gap-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          {(['Critical', 'High', 'Standard'] as const).map((sev) => {
            const count = alerts.filter((a) => getSeverityForAlert(a) === sev).length;
            const color = sev === 'Critical' ? 'text-red-400' : sev === 'High' ? 'text-orange-400' : 'text-yellow-400';
            return (
              <div key={sev} className="flex items-center gap-2">
                <span className={`text-2xl font-black tabular-nums ${color}`}>{count}</span>
                <span className="text-gray-500 text-sm">{t(`severity.${sev.toLowerCase()}`, sev)}</span>
              </div>
            );
          })}

          {staleCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold tabular-nums">{staleCount}</span>
              <span className="text-gray-500 text-sm">{t('authority_sos.stale_location', 'Stale location')}</span>
            </div>
          )}

          <div className="flex items-center gap-2 ms-auto">
            <span className="text-2xl font-black tabular-nums text-white">{data.totalCount}</span>
            <span className="text-gray-500 text-sm">{t('authority_sos.total_active', 'Total Active')}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SEVERITIES.map((sev) => (
          <button
            key={sev || 'all'}
            onClick={() => handleSeverityChange(sev)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              severityFilter === sev ? SEV_ACTIVE[sev] : SEV_COLORS[sev]
            }`}
          >
            {sev === '' ? t('common.all', 'All') : t(`severity.${sev.toLowerCase()}`, sev)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => <Skeleton key={n} type="card" className="h-96" />)}
        </div>
      ) : !alerts.length ? (
        <EmptyState title={t('authority_sos.all_clear', 'All Clear')} message={t('authority_sos.no_active_sos', 'No active SOS alerts in your jurisdiction.')} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {alerts.map((alert) => (
            <SOSCard
              key={alert.id}
              alert={alert}
              cardState={cardStates[alert.id] ?? null}
              communityNameMap={communityNameMap}
              onAction={handleAction(alert.id)}
              onOpenDetail={() => setDetailAlert(alert)}
              onPanned={() => dispatch({ type: 'USER_PANNED', id: alert.id })}
              onRecenter={() => {
                dispatch({ type: 'RECENTER', id: alert.id });
                setRecenterNonces((prev) => ({
                  ...prev,
                  [alert.id]: (prev[alert.id] ?? 0) + 1,
                }));
              }}
              recenterNonce={recenterNonces[alert.id] ?? 0}
              isReconnecting={isReconnecting}
              isPending={actionMutation.isPending}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {detailAlert && (
        <SOSDetailModal
          alert={detailAlert}
          communityNameMap={communityNameMap}
          onClose={() => setDetailAlert(null)}
          onAction={handleAction(detailAlert.id)}
          isPending={actionMutation.isPending}
        />
      )}
    </div>
  );
}