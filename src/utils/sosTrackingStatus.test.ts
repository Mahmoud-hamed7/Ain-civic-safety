import { describe, expect, it } from 'vitest';
import {
  getTrackingStatus,
  getTrackingBadgeLabel,
  hasIncidentLocationData,
  shouldShowLastPingText,
  shouldShowNoPingsMessage,
  isStaleForDisplay,
} from './sosTrackingStatus';

describe('hasIncidentLocationData', () => {
  it('returns false with zero updates and empty history', () => {
    expect(hasIncidentLocationData(0, 0)).toBe(false);
  });

  it('returns true when updates exist', () => {
    expect(hasIncidentLocationData(3, 0)).toBe(true);
  });

  it('returns true when history was loaded even if list count is 0', () => {
    expect(hasIncidentLocationData(0, 2)).toBe(true);
  });
});

describe('getTrackingStatus', () => {
  const base = { totalLocationUpdates: 0, locationHistoryLength: 0, isLocationStale: false };

  it('zero updates → waiting (ignores stale flag and default lastLocationPingAt)', () => {
    expect(getTrackingStatus({ ...base, isLocationStale: true })).toBe('waiting');
    expect(shouldShowNoPingsMessage(base)).toBe(true);
    expect(shouldShowLastPingText(base)).toBe(false);
    expect(isStaleForDisplay({ ...base, isLocationStale: true })).toBe(false);
  });

  it('updates + stale → stopped', () => {
    const input = { totalLocationUpdates: 5, locationHistoryLength: 5, isLocationStale: true };
    expect(getTrackingStatus(input)).toBe('stopped');
    expect(getTrackingBadgeLabel('stopped')).toBe('Location updates stopped');
    expect(shouldShowLastPingText(input)).toBe(true);
    expect(shouldShowNoPingsMessage(input)).toBe(false);
    expect(isStaleForDisplay(input)).toBe(true);
  });

  it('updates + fresh → live', () => {
    const input = { totalLocationUpdates: 2, locationHistoryLength: 2, isLocationStale: false };
    expect(getTrackingStatus(input)).toBe('live');
    expect(getTrackingBadgeLabel('live')).toBe('Live tracking');
    expect(shouldShowLastPingText(input)).toBe(true);
    expect(isStaleForDisplay(input)).toBe(false);
  });
});
