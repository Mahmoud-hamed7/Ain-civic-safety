/**
 * SOSDetailModal — full alert drill-down for Authority SOS Monitor.
 * Fetches GET /{id}, /{id}/live-state, and location history on open.
 * Sensitive reporter fields are shown only here, not on summary cards.
 */
import { useQuery } from '@tanstack/react-query';
import { X, Phone, CreditCard, MapPin, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '../../api/client';
import MediaImage from '../../components/MediaImage';
import { fetchSOSLocationHistory } from '../../api/sos';
import { normalizeSeverity, normalizeStatus } from '../../utils/sos';
import { resolveLastKnownLocation, unwrapApiPayload } from '../../utils/sosLocation';
import { resolveCommunityName } from '../../hooks/useCommunityNameMap';
import SOSBroadcastLabel from './SOSBroadcastLabel';
import SOSLiveMap from '../Map/SOSLiveMap';
import Button from '../Button';
import SeveritySelector from '../SeveritySelector';
import type { SOSAlertListItem, SOSAlertToReturnDto, SOSLiveStateDto } from '../../types';

interface Props {
  alert: SOSAlertListItem;
  communityNameMap: Map<string, string>;
  onClose: () => void;
  onAction: (action: string, payload?: string) => void;
  isPending: boolean;
}

export default function SOSDetailModal({
  alert,
  communityNameMap,
  onClose,
  onAction,
  isPending,
}: Props) {
  const { data: detail, isLoading: detailLoading } = useQuery<SOSAlertToReturnDto>({
    queryKey: ['sos', alert.id, 'detail'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/sosalerts/${alert.id}`);
      const d = unwrapApiPayload<any>(res.data);
      return {
        ...d,
        status: normalizeStatus(d.status) as SOSAlertToReturnDto['status'],
        severity: normalizeSeverity(d.severity),
        affectedCommunityIds:
          d.affectedCommunityIds ?? d.AffectedCommunityIds ?? alert.affectedCommunityIds,
      };
    },
  });

  const { data: liveState } = useQuery<SOSLiveStateDto>({
    queryKey: ['sos', alert.id, 'live-state'],
    queryFn: async () => {
      const res = await apiClient.get(`/api/sosalerts/${alert.id}/live-state`);
      const d = res.data;
      return {
        ...d,
        status: normalizeStatus(d.status),
        severity: normalizeSeverity(d.severity),
      };
    },
  });

  const { data: locationHistory = [] } = useQuery({
    queryKey: ['sos', alert.id, 'locations', 'detail-modal'],
    queryFn: () => fetchSOSLocationHistory(alert.id),
  });

  const communityName = resolveCommunityName(communityNameMap, alert.communityId);
  const severity = normalizeSeverity(detail?.severity ?? alert.severity);
  const reporter = detail?.reporter;
  const totalUpdates = Math.max(
    detail?.totalLocationUpdates ?? alert.totalLocationUpdates,
    locationHistory.length,
  );
  const latestLocation = locationHistory.length > 0
    ? locationHistory[locationHistory.length - 1]
    : null;
  const hasIncidentData = totalUpdates > 0 || locationHistory.length > 0;

  const lastKnownLocation = resolveLastKnownLocation(
    reporter,
    detail?.recentLocations ?? locationHistory,
    liveState ?? null,
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">SOS Alert Details</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Alert ID: {alert.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {detailLoading ? (
            <p className="text-gray-500 text-sm">Loading alert details…</p>
          ) : (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                  severity === 'Critical' ? 'bg-red-600' : severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                }`}>
                  {severity}
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-600">
                  {communityName}
                </span>
                <SOSBroadcastLabel
                  communityId={alert.communityId}
                  affectedCommunityIds={detail?.affectedCommunityIds ?? alert.affectedCommunityIds}
                  nameMap={communityNameMap}
                  className="w-full text-xs text-indigo-300 mt-1"
                />
                {communityName === 'Unknown Community' && (
                  <span className="text-[10px] text-gray-600 font-mono">
                    Community ID: …{alert.communityId.slice(-8)}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs bg-gray-800 text-gray-400">
                  {normalizeStatus(detail?.status ?? alert.status)}
                </span>
              </div>

              {alert.message && (
                <p className="text-white text-sm font-medium">{alert.message}</p>
              )}

              {/* Lifecycle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-800/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="text-gray-200">{format(new Date(alert.createdAtUtc), 'PPp')}</p>
                  </div>
                </div>
                {detail?.expiresAtUtc && (
                  <div className="bg-gray-800/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <p className="text-gray-500">Expires</p>
                      <p className="text-gray-200">{format(new Date(detail.expiresAtUtc), 'PPp')}</p>
                    </div>
                  </div>
                )}
                {detail?.resolvedAtUtc && (
                  <div className="bg-gray-800/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <p className="text-gray-500">Resolved</p>
                      <p className="text-gray-200">{format(new Date(detail.resolvedAtUtc), 'PPp')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Initiator / reporter — sensitive fields only in detail view */}
              {reporter && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-white">Initiator / Reporter</h3>
                  <div className="flex items-start gap-4">
                    {reporter.profilePhotoUrl && (
                      <MediaImage
                        src={reporter.profilePhotoUrl}
                        alt={reporter.fullName}
                        className="w-14 h-14 rounded-full object-cover border border-gray-600"
                      />
                    )}
                    <div className="space-y-1.5 text-sm flex-1">
                      <p className="text-white font-semibold">{reporter.fullName}</p>
                      {reporter.phoneNumber && (
                        <p className="text-gray-400 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {reporter.phoneNumber}
                        </p>
                      )}
                      {reporter.nationalId && (
                        <p className="text-gray-400 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> National ID: {reporter.nationalId}
                        </p>
                      )}
                      {reporter.lastKnownLocationName && (
                        <p className="text-gray-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {reporter.lastKnownLocationName}
                        </p>
                      )}
                      {lastKnownLocation && (
                        <p className="text-[10px] text-gray-500 font-mono">
                          Profile location: {lastKnownLocation.lat.toFixed(5)}, {lastKnownLocation.lng.toFixed(5)}
                          <span className="text-gray-600 ml-1">(general — not from this alert)</span>
                        </p>
                      )}
                    </div>
                    {reporter.idCardPhotoUrl && (
                      <MediaImage
                        src={reporter.idCardPhotoUrl}
                        alt="ID card"
                        className="w-24 h-16 rounded-lg object-cover border border-gray-600"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Live-state member tracking */}
              {liveState && liveState.memberLocations.length > 0 && (
                <div className="bg-gray-800/30 rounded-xl px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  {liveState.totalActiveMembers} members active ·{' '}
                  {liveState.totalStaleMembers} stale ·{' '}
                  {liveState.totalLocationPendingMembers} pending location
                </div>
              )}

              {/* Map with full trail */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">
                  Location History ({locationHistory.length} points)
                </h3>
                <SOSLiveMap
                  sosId={alert.id}
                  locationHistory={locationHistory}
                  latestLocation={latestLocation}
                  lastPingAgeSeconds={0}
                  userHasPanned={false}
                  onUserPanned={() => {}}
                  onRecenter={() => {}}
                  recenterNonce={0}
                  lastKnownLocation={!hasIncidentData ? lastKnownLocation : null}
                  liveState={liveState ?? null}
                  initiatorName={liveState?.initiatorName ?? reporter?.fullName ?? null}
                  hasIncidentLocationData={hasIncidentData}
                />
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-800 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAction('resolve')} isLoading={isPending} className="flex-1 min-w-[120px]">
            Resolve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onAction('false-alarm')} isLoading={isPending} className="flex-1 min-w-[120px]">
            False Alarm
          </Button>
          <div className="w-full">
            <SeveritySelector
              current={severity}
              alertId={alert.id}
              isPending={isPending}
              onConfirm={(newSev) => onAction('severity', newSev)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
