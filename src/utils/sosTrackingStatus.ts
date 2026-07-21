/**
 * SOS tracking display logic — single source of truth for card/map UI.
 *
 * `totalLocationUpdates` from the list endpoint is authoritative for whether
 * incident-level GPS tracking has ever started. `lastLocationPingAt` is only
 * meaningful when at least one update exists (or history was loaded).
 */

export type TrackingStatus = 'waiting' | 'live' | 'stopped';

export interface TrackingStatusInput {
  totalLocationUpdates: number;
  locationHistoryLength: number;
  isLocationStale: boolean;
}

/** True when real incident location data exists (not reporter profile fallback). */
export function hasIncidentLocationData(
  totalLocationUpdates: number,
  locationHistoryLength: number,
): boolean {
  return totalLocationUpdates > 0 || locationHistoryLength > 0;
}

/** Mutually exclusive tracking badge — priority: waiting → stopped → live. */
export function getTrackingStatus(input: TrackingStatusInput): TrackingStatus {
  if (!hasIncidentLocationData(input.totalLocationUpdates, input.locationHistoryLength)) {
    return 'waiting';
  }
  if (input.isLocationStale) return 'stopped';
  return 'live';
}

export function getTrackingBadgeLabel(status: TrackingStatus): string {
  switch (status) {
    case 'waiting': return 'Waiting for GPS';
    case 'stopped': return 'Location updates stopped';
    case 'live': return 'Live tracking';
  }
}

export function shouldShowLastPingText(input: TrackingStatusInput): boolean {
  return hasIncidentLocationData(input.totalLocationUpdates, input.locationHistoryLength);
}

export function shouldShowNoPingsMessage(input: TrackingStatusInput): boolean {
  return !hasIncidentLocationData(input.totalLocationUpdates, input.locationHistoryLength);
}

/** Stale styling/banners only apply after tracking has actually started. */
export function isStaleForDisplay(input: TrackingStatusInput): boolean {
  return getTrackingStatus(input) === 'stopped';
}
