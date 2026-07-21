/**
 * Resolve displayable map coordinates from SOS alert sources.
 * Rejects null and (0,0) which the API uses as "no location".
 */
import type { SOSLocationDto, SOSLiveStateDto, SOSReporterDto } from '../types';

export function isValidMapCoord(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export interface ResolvedLastLocation {
  lat: number;
  lng: number;
  name?: string | null;
  /** Where the coordinates came from — used for map labeling. */
  source: 'profile' | 'recent' | 'live-state';
}

/** Unwrap `{ isSuccess, data }` envelopes from API responses. */
export function unwrapApiPayload<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data: unknown }).data != null) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Best available last-known point before/during waiting for live incident tracking.
 * Priority: reporter profile → recentLocations → live-state initiator coords.
 */
export function resolveLastKnownLocation(
  reporter: SOSReporterDto | null | undefined,
  recentLocations: SOSLocationDto[] | null | undefined,
  liveState: SOSLiveStateDto | null | undefined,
): ResolvedLastLocation | null {
  if (reporter && isValidMapCoord(reporter.lastKnownLatitude, reporter.lastKnownLongitude)) {
    return {
      lat: reporter.lastKnownLatitude!,
      lng: reporter.lastKnownLongitude!,
      name: reporter.lastKnownLocationName,
      source: 'profile',
    };
  }

  const validRecent = (recentLocations ?? []).filter((l) =>
    isValidMapCoord(l.latitude, l.longitude),
  );
  if (validRecent.length > 0) {
    const last = validRecent[validRecent.length - 1];
    return {
      lat: last.latitude,
      lng: last.longitude,
      name: last.locationName,
      source: 'recent',
    };
  }

  if (liveState && isValidMapCoord(liveState.initiatorLatitude, liveState.initiatorLongitude)) {
    return {
      lat: liveState.initiatorLatitude,
      lng: liveState.initiatorLongitude,
      source: 'live-state',
    };
  }

  return null;
}
