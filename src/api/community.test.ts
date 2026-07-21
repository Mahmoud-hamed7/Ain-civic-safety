import { describe, expect, it } from 'vitest';
import { parseRegenerateCodeResponse, parseJoinRequestsResponse, parseMemberDetailResponse, parseCommunitySearchResponse, parseCreateCommunityResponse, parseCommunityDetail, parseNearbyCommunitiesResponse } from './community';
import { parseMyCommunitiesResponse } from '../utils/citizenCommunities';

describe('parseRegenerateCodeResponse', () => {
  it('maps newInviteCode from API to inviteCode alias', () => {
    const result = parseRegenerateCodeResponse({
      communityId: '6989f65a-3398-4c38-ae0d-e080823c9df5',
      newInviteCode: 'MA9X5E',
    });
    expect(result.newInviteCode).toBe('MA9X5E');
    expect(result.inviteCode).toBe('MA9X5E');
  });
});

describe('community API parsers — live contract', () => {
  it('parses join request status integer', () => {
    const list = parseJoinRequestsResponse([
      {
        memberId: 'm1',
        userId: 'u1',
        userName: 'Test User',
        requestedAt: '2026-06-22T15:40:36Z',
        status: 0,
      },
    ]);
    expect(list[0].status).toBe('Pending');
  });

  it('parses member communityRole integer and joinStatus integer', () => {
    const list = parseMemberDetailResponse([
      {
        userId: 'u1',
        userName: 'member',
        communityRole: 2,
        communityRoleName: 'Admin',
        joinStatus: 1,
        joinedAt: '2026-06-22T00:00:00Z',
        email: 'a@b.com',
      },
    ]);
    expect(list[0].role).toBe('Admin');
    expect(list[0].joinStatus).toBe('Approved');
    expect(list[0].email).toBe('a@b.com');
  });

  it('parses search myJoinStatus integer', () => {
    const list = parseCommunitySearchResponse([
      {
        id: 'c1',
        name: 'Ali',
        communityType: 0,
        memberCount: 3,
        acceptsJoinRequests: true,
        hasActiveInviteCode: false,
        isAlreadyMember: false,
        myJoinStatus: 0,
      },
    ]);
    expect(list[0].myJoinStatus).toBe('Pending');
    expect(list[0].communityType).toBe('Neighborhood');
  });

  it('parses create community response with invite code', () => {
    const result = parseCreateCommunityResponse({
      id: 'c-new',
      name: 'Test Building',
      communityType: 1,
      inviteCode: 'ABC123',
      inviteCodeExpiresAt: '2026-12-31T00:00:00Z',
    });
    expect(result.id).toBe('c-new');
    expect(result.inviteCode).toBe('ABC123');
    expect(result.communityType).toBe(1);
  });

  it('parses GET /Community/{id} swagger shape (text/plain JSON string)', () => {
    const json = JSON.stringify({
      id: 'c1',
      name: 'Nasr City',
      description: 'Neighborhood group',
      communityType: 0,
      totalMemberCount: 5,
      activeMemberCount: 3,
      locationPendingCount: 1,
      createdById: 'user-1',
      createdByName: 'Ahmed',
      members: [
        { usrId: 'user-1', userName: 'Ahmed', role: 'Owner' },
        { usrId: 'user-2', userName: 'Sara', role: 'Member' },
      ],
    });
    const detail = parseCommunityDetail(json, 'user-1');
    expect(detail.name).toBe('Nasr City');
    expect(detail.memberCount).toBe(5);
    expect(detail.myRole).toBe('Owner');
    expect(detail.members).toHaveLength(2);
    expect(detail.members![0].userId).toBe('user-1');
  });

  it('parses GET /Community single-object list response', () => {
    const list = parseMyCommunitiesResponse({ id: 'c1', name: 'Only One' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('c1');
  });

  it('parses nearby communities with distanceMeters', () => {
    const list = parseNearbyCommunitiesResponse({
      items: [
        {
          id: 'n1',
          name: 'Nearby Hood',
          communityType: 0,
          distanceMeters: 450,
          memberCount: 12,
          coverageRadiusMeters: 1000,
        },
      ],
    });
    expect(list[0].distanceMeters).toBe(450);
    expect(list[0].communityType).toBe(0);
  });
});
