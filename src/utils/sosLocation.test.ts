import { describe, expect, it } from 'vitest';
import { isValidMapCoord, resolveLastKnownLocation } from './sosLocation';

describe('isValidMapCoord', () => {
  it('rejects null and 0,0', () => {
    expect(isValidMapCoord(null, 31)).toBe(false);
    expect(isValidMapCoord(30, null)).toBe(false);
    expect(isValidMapCoord(0, 0)).toBe(false);
  });

  it('accepts real coordinates', () => {
    expect(isValidMapCoord(30.0444, 31.2357)).toBe(true);
  });
});

describe('resolveLastKnownLocation', () => {
  it('prefers reporter profile over live-state', () => {
    const result = resolveLastKnownLocation(
      {
        userId: '1',
        fullName: 'Test',
        profilePhotoUrl: null,
        idCardPhotoUrl: null,
        nationalId: null,
        phoneNumber: null,
        lastKnownLatitude: 30.1,
        lastKnownLongitude: 31.2,
        lastKnownLocationName: 'Cairo',
      },
      [],
      {
        sosAlertId: 'a',
        communityId: 'c',
        status: 'Active',
        severity: 'Standard',
        initiatorUserId: '1',
        initiatorName: 'Test',
        initiatorLatitude: 29.9,
        initiatorLongitude: 31.0,
        initiatorLastPingAt: null,
        isInitiatorLocationStale: false,
        memberLocations: [],
        totalActiveMembers: 0,
        totalLocationPendingMembers: 0,
        totalStaleMembers: 0,
        generatedAt: '',
      },
    );
    expect(result?.source).toBe('profile');
    expect(result?.lat).toBe(30.1);
  });

  it('falls back to live-state when profile is 0,0', () => {
    const result = resolveLastKnownLocation(
      {
        userId: '1',
        fullName: 'Test',
        profilePhotoUrl: null,
        idCardPhotoUrl: null,
        nationalId: null,
        phoneNumber: null,
        lastKnownLatitude: 0,
        lastKnownLongitude: 0,
        lastKnownLocationName: null,
      },
      [],
      {
        sosAlertId: 'a',
        communityId: 'c',
        status: 'Active',
        severity: 'Standard',
        initiatorUserId: '1',
        initiatorName: 'Test',
        initiatorLatitude: 30.2975,
        initiatorLongitude: 31.7412,
        initiatorLastPingAt: null,
        isInitiatorLocationStale: false,
        memberLocations: [],
        totalActiveMembers: 0,
        totalLocationPendingMembers: 0,
        totalStaleMembers: 0,
        generatedAt: '',
      },
    );
    expect(result?.source).toBe('live-state');
    expect(result?.lat).toBe(30.2975);
  });
});
