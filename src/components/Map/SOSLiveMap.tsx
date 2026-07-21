/**
 * SOSLiveMap — live map for a single SOS alert card or detail view.
 *
 * Map is always mounted. When no incident tracking yet, shows last-known point
 * (profile / recentLocations / live-state) with a visible pin + waiting overlay.
 */
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker,
  Tooltip, Popup, useMap,
} from 'react-leaflet';
import { Crosshair, Radio } from 'lucide-react';
import { createCustomIcon, TILE_URL } from '../../utils/map';
import type { ResolvedLastLocation } from '../../utils/sosLocation';
import type { SOSLocationDto, SOSLiveStateDto } from '../../types';

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357];
const LAST_KNOWN_PIN_COLOR = '#6b7280';

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return isoStr; }
}

function AutoPanner({
  target,
  userHasPanned,
}: {
  target: [number, number] | null;
  userHasPanned: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target || userHasPanned) return;
    map.panTo(target, { animate: true, duration: 0.5 });
  }, [target, userHasPanned, map]);
  return null;
}

function RecenterOnDemand({
  target,
  nonce,
}: {
  target: [number, number] | null;
  nonce: number;
}) {
  const map = useMap();
  const prevNonce = useRef(nonce);
  useEffect(() => {
    if (nonce > prevNonce.current && target) {
      map.panTo(target, { animate: true, duration: 0.5 });
    }
    prevNonce.current = nonce;
  }, [nonce, target, map]);
  return null;
}

/** Pan/zoom when last-known coords load async (MapContainer center prop is initial-only). */
function MapViewUpdater({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  const prevKey = useRef('');
  useEffect(() => {
    const key = `${center[0]},${center[1]},${zoom}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    map.setView(center, zoom, { animate: false });
  }, [center, center[0], center[1], zoom, map]);
  return null;
}

function DragDetector({ onUserPanned }: { onUserPanned: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('dragstart', onUserPanned);
    return () => { map.off('dragstart', onUserPanned); };
  }, [map, onUserPanned]);
  return null;
}

function FitBoundsOnMount({ points }: { points: [number, number][] }) {
  const map = useMap();
  const lastKey = useRef('');
  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map((p) => p.join(',')).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
    } else {
      try {
        map.fitBounds(points as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 16 });
      } catch { /* noop */ }
    }
  }, [points, map]);
  return null;
}

function WaitingForGpsOverlay({
  initiatorName,
  hasLastLocationPin,
}: {
  initiatorName: string | null;
  hasLastLocationPin: boolean;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-3 z-[500] flex justify-center px-3 pointer-events-none"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl
        bg-gray-900/90 backdrop-blur-sm border border-amber-500/35 shadow-lg max-w-sm"
      >
        <Radio className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <div className="text-left min-w-0">
          <p className="text-xs font-semibold text-amber-300">Waiting for GPS</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {hasLastLocationPin
              ? 'Last known location shown — live tracking not started yet'
              : initiatorName
                ? <>No location pings from <span className="text-gray-300">{initiatorName}</span> yet</>
                : 'No location pings received for this alert yet'}
          </p>
        </div>
      </div>
    </div>
  );
}

function lastKnownSourceLabel(source: ResolvedLastLocation['source']): string {
  switch (source) {
    case 'profile': return 'profile';
    case 'recent': return 'recent alert data';
    case 'live-state': return 'last snapshot';
    default: return 'saved';
  }
}

export interface SOSLiveMapProps {
  sosId: string;
  locationHistory: SOSLocationDto[];
  latestLocation: SOSLocationDto | null;
  lastPingAgeSeconds: number;
  userHasPanned: boolean;
  onUserPanned: () => void;
  onRecenter: () => void;
  recenterNonce: number;
  /** Resolved from reporter / recentLocations / live-state — shown while waiting for live pings. */
  lastKnownLocation: ResolvedLastLocation | null;
  liveState: SOSLiveStateDto | null;
  initiatorName: string | null;
  hasIncidentLocationData: boolean;
}

export default function SOSLiveMap({
  locationHistory,
  latestLocation,
  lastPingAgeSeconds,
  userHasPanned,
  onUserPanned,
  onRecenter,
  recenterNonce,
  lastKnownLocation,
  liveState,
  initiatorName,
  hasIncidentLocationData,
}: SOSLiveMapProps) {
  const initiatorStale =
    hasIncidentLocationData &&
    (liveState?.isInitiatorLocationStale ?? lastPingAgeSeconds > 90);
  const isLost300 = hasIncidentLocationData && lastPingAgeSeconds > 300;
  const pinColor = isLost300 ? '#6b7280' : initiatorStale ? '#f59e0b' : '#ef4444';
  const pulse = hasIncidentLocationData && !isLost300 && !initiatorStale;

  const trailPositions: [number, number][] = hasIncidentLocationData
    ? locationHistory.map((l) => [l.latitude, l.longitude])
    : [];

  const liveCoords: [number, number] | null =
    hasIncidentLocationData &&
    liveState?.initiatorLatitude &&
    liveState.initiatorLatitude !== 0
      ? [liveState.initiatorLatitude, liveState.initiatorLongitude]
      : null;

  const effectivePinPos: [number, number] | null = hasIncidentLocationData
    ? (latestLocation
        ? [latestLocation.latitude, latestLocation.longitude]
        : liveCoords)
    : null;

  const accuracy = latestLocation?.accuracyMeters ?? null;
  const panTarget = effectivePinPos;

  const showLastLocationPin = !effectivePinPos && !!lastKnownLocation;
  const lastPinPos: [number, number] | null = showLastLocationPin
    ? [lastKnownLocation!.lat, lastKnownLocation!.lng]
    : null;

  const mapCenter: [number, number] =
    effectivePinPos ?? lastPinPos ?? DEFAULT_CENTER;

  const mapZoom = effectivePinPos || lastPinPos ? 15 : 12;
  const recenterTarget = effectivePinPos ?? lastPinPos;

  const allPoints: [number, number][] = [
    ...trailPositions,
    ...(liveCoords && !latestLocation ? [liveCoords] : []),
    ...(lastPinPos ? [lastPinPos] : []),
    ...(liveState?.memberLocations ?? [])
      .filter((m) => m.latitude !== 0 || m.longitude !== 0)
      .map((m) => [m.latitude, m.longitude] as [number, number]),
  ];

  const showWaitingOverlay = !hasIncidentLocationData;
  const locationName = lastKnownLocation?.name ?? null;

  return (
    <div className="relative">
      {userHasPanned && recenterTarget && (
        <button
          onClick={onRecenter}
          className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            bg-gray-900/90 backdrop-blur-sm border border-gray-600 text-xs text-white
            hover:bg-gray-800 hover:border-gray-400 transition-all shadow-lg"
        >
          <Crosshair className="w-3 h-3 text-indigo-400" />
          ↗ Re-center
        </button>
      )}

      {showLastLocationPin && lastKnownLocation && (
        <div className="absolute top-2 left-2 right-2 z-[1000] px-3 py-1.5 rounded-lg
          bg-gray-900/90 backdrop-blur-sm border border-gray-600 text-[10px] text-gray-400 shadow-lg pointer-events-none"
        >
          Last known location ({lastKnownSourceLabel(lastKnownLocation.source)}) — not live incident tracking
        </div>
      )}

      {initiatorStale && effectivePinPos && (
        <div className="absolute top-2 left-2 right-12 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-gray-900/90 backdrop-blur-sm border border-amber-500/40 text-xs text-amber-400 shadow-lg pointer-events-none"
        >
          <span className="font-bold">⚠</span>
          Location updates stopped. Last known position shown.
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden border ${
          showWaitingOverlay
            ? 'border-gray-700/50'
            : isLost300
              ? 'border-gray-600'
              : initiatorStale
                ? 'border-amber-500/40'
                : 'border-indigo-500/30'
        }`}
        style={{ height: '280px' }}
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full z-0"
          scrollWheelZoom
          zoomControl
          attributionControl={false}
        >
          <TileLayer url={TILE_URL} />
          <MapViewUpdater center={mapCenter} zoom={mapZoom} />
          <FitBoundsOnMount points={allPoints} />
          <AutoPanner target={panTarget ?? lastPinPos} userHasPanned={userHasPanned} />
          <RecenterOnDemand target={recenterTarget} nonce={recenterNonce} />
          <DragDetector onUserPanned={onUserPanned} />

          {showLastLocationPin && lastPinPos && lastKnownLocation && (
            <>
              <Marker
                key={`last-known-${lastPinPos[0]}-${lastPinPos[1]}`}
                position={lastPinPos}
                icon={createCustomIcon(LAST_KNOWN_PIN_COLOR, 28, false)}
                zIndexOffset={500}
              >
                <Tooltip permanent direction="top" offset={[0, -28]} opacity={0.95}>
                  <span className="text-xs font-semibold">
                    📍 Last known location
                    {locationName && <><br />{locationName}</>}
                    {initiatorName && <><br />{initiatorName}</>}
                  </span>
                </Tooltip>
                <Popup>
                  <div className="text-xs text-gray-700">
                    <strong>Last known location</strong>
                    ({lastKnownSourceLabel(lastKnownLocation.source)})<br />
                    {locationName && <>{locationName}<br /></>}
                    {lastPinPos[0].toFixed(5)}, {lastPinPos[1].toFixed(5)}
                    <br />
                    <span className="text-gray-500">Not live incident tracking.</span>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={lastPinPos}
                radius={150}
                pathOptions={{
                  color: LAST_KNOWN_PIN_COLOR,
                  fillColor: LAST_KNOWN_PIN_COLOR,
                  fillOpacity: 0.08,
                  opacity: 0.45,
                  weight: 2,
                  dashArray: '6, 6',
                }}
              />
            </>
          )}

          {trailPositions.length >= 2 && (
            <Polyline
              positions={trailPositions}
              color="#3b82f6"
              weight={2}
              opacity={0.5}
            />
          )}

          {hasIncidentLocationData && locationHistory.map((loc, i) => (
            <CircleMarker
              key={`ghost-${loc.recordedAtUtc}-${i}`}
              center={[loc.latitude, loc.longitude]}
              radius={4}
              pathOptions={{
                color: '#9ca3af',
                fillColor: '#6b7280',
                fillOpacity: 0.6,
                weight: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
                <span className="text-xs">{formatTime(loc.recordedAtUtc)}</span>
              </Tooltip>
            </CircleMarker>
          ))}

          {effectivePinPos && accuracy !== null && accuracy > 0 && (
            <Circle
              center={effectivePinPos}
              radius={accuracy}
              pathOptions={{
                color: 'rgba(239,68,68,0.5)',
                fillColor: 'rgba(239,68,68,0.1)',
                fillOpacity: 0.1,
                opacity: 0.5,
                weight: 1.5,
              }}
            >
              <Tooltip permanent direction="bottom">
                <span className="text-[11px] font-semibold">±{Math.round(accuracy)}m</span>
              </Tooltip>
            </Circle>
          )}

          {effectivePinPos && (
            <Marker
              position={effectivePinPos}
              icon={createCustomIcon(pinColor, 26, pulse)}
            >
              <Tooltip direction="top" offset={[0, -26]} opacity={0.95}>
                <span className="text-xs">
                  {effectivePinPos[0].toFixed(5)}, {effectivePinPos[1].toFixed(5)}
                  {initiatorName && <><br />{initiatorName}</>}
                </span>
              </Tooltip>
            </Marker>
          )}

          {liveState?.memberLocations
            ?.filter((m) => m.latitude !== 0 || m.longitude !== 0)
            .map((m) => (
              <CircleMarker
                key={m.userId}
                center={[m.latitude, m.longitude]}
                radius={6}
                pathOptions={{
                  color: m.isStale ? '#6b7280' : '#3b82f6',
                  fillColor: m.isStale ? '#4b5563' : '#60a5fa',
                  fillOpacity: m.isStale ? 0.5 : 0.8,
                  weight: 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="text-xs">
                    {m.userName} · {m.secondsSinceLastUpdate}s ago
                  </span>
                </Tooltip>
              </CircleMarker>
            ))}
        </MapContainer>

        {showWaitingOverlay && (
          <WaitingForGpsOverlay
            initiatorName={initiatorName}
            hasLastLocationPin={showLastLocationPin}
          />
        )}
      </div>
    </div>
  );
}
