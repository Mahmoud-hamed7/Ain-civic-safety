import apiClient from './client';
import type { QueryClient } from '@tanstack/react-query';
import type {
  BulkRegenerateInviteCodesResponse,
  CommunityDetailDto,
  CommunityJoinResultDto,
  CommunitySearchResultDto,
  CommunityTypeName,
  JoinRequestDto,
  MemberDetailDto,
} from '../types/community';
import type { CommunityMemberDto, CreateCommunityRequest, CreateCommunityResponse, JoinCommunityResponse, NearbyCommunityDto, RegenerateCodeResponse } from '../types';
import { normalizeCommunityType } from '../utils/communities';
import { parseMyCommunitiesResponse } from '../utils/citizenCommunities';
import { parseCommunityRole, parseJoinStatus, communityRoleToInt, parseMemberLocationStatus } from '../utils/communityEnums';
import { myMembership } from '../utils/communityCitizen';
import { communityKeys } from '../queryKeys';
import { asRecord, pick, unwrapApiBody } from '../utils/apiBody';

function parseList<T>(data: unknown, ...listKeys: string[]): T[] {
  const body = unwrapApiBody(data);
  if (Array.isArray(body)) return body as T[];
  const obj = asRecord(body);
  const unwrapped = obj.data ?? obj.Data;
  if (Array.isArray(unwrapped)) return unwrapped as T[];
  for (const key of listKeys) {
    const val = obj[key];
    if (Array.isArray(val)) return val as T[];
  }
  if (unwrapped && typeof unwrapped === 'object') {
    const inner = unwrapped as Record<string, unknown>;
    for (const key of listKeys) {
      const val = inner[key];
      if (Array.isArray(val)) return val as T[];
    }
  }
  return [];
}

function normalizeLegacyMember(raw: unknown): CommunityMemberDto {
  const obj = asRecord(raw);
  const loc = obj.userLocation ?? obj.UserLocation;
  const locationObj = loc && typeof loc === 'object' ? (loc as Record<string, unknown>) : null;
  const lat = pick<number>(obj, 'locationLatitude', 'LocationLatitude');
  const lng = pick<number>(obj, 'locationLongitude', 'LocationLongitude');

  return {
    userId: pick<string>(obj, 'userId', 'UserId', 'usrId', 'UsrId') ?? '',
    userName: pick<string>(obj, 'userName', 'UserName') ?? '—',
    role: parseCommunityRole(
      pick(obj, 'communityRole', 'CommunityRole', 'role', 'Role'),
      pick(obj, 'communityRoleName', 'CommunityRoleName'),
    ),
    memberStatus: pick(obj, 'memberStatus', 'MemberStatus') as CommunityMemberDto['memberStatus'],
    usrId: pick<string>(obj, 'usrId', 'UsrId'),
    userLocation: locationObj
      ? {
          latitude: Number(pick(locationObj, 'latitude', 'Latitude') ?? 0),
          longitude: Number(pick(locationObj, 'longitude', 'Longitude') ?? 0),
          city: pick<string>(locationObj, 'city', 'City'),
          town: pick<string>(locationObj, 'town', 'Town'),
          street: pick<string>(locationObj, 'street', 'Street'),
        }
      : lat != null && lng != null
        ? { latitude: Number(lat), longitude: Number(lng) }
        : null,
    lastLocationUpdatedAt:
      pick<string>(obj, 'lastLocationUpdatedAt', 'LastLocationUpdatedAt') ?? null,
  };
}

export function normalizeMemberDetail(raw: unknown): MemberDetailDto {
  const obj = asRecord(raw);
  const lat = pick<number>(obj, 'locationLatitude', 'LocationLatitude');
  const lng = pick<number>(obj, 'locationLongitude', 'LocationLongitude');
  const loc = obj.userLocation ?? obj.UserLocation;
  const locationObj = loc && typeof loc === 'object' ? (loc as Record<string, unknown>) : null;

  return {
    userId: pick<string>(obj, 'userId', 'UserId', 'usrId', 'UsrId') ?? '',
    userName: pick<string>(obj, 'userName', 'UserName') ?? '—',
    role: parseCommunityRole(
      pick(obj, 'communityRole', 'CommunityRole', 'role', 'Role'),
      pick(obj, 'communityRoleName', 'CommunityRoleName'),
    ),
    joinStatus: parseJoinStatus(
      pick(obj, 'joinStatus', 'JoinStatus', 'memberStatus', 'MemberStatus') ?? 'Approved',
    ),
    joinedAt: pick<string>(obj, 'joinedAt', 'JoinedAt') ?? '',
    email: pick<string>(obj, 'email', 'Email'),
    phoneNumber: pick<string>(obj, 'phoneNumber', 'PhoneNumber'),
    locationLatitude: lat ?? (locationObj ? Number(pick(locationObj, 'latitude', 'Latitude')) : undefined),
    locationLongitude: lng ?? (locationObj ? Number(pick(locationObj, 'longitude', 'Longitude')) : undefined),
    lastLocationUpdatedAt:
      pick<string>(obj, 'lastLocationUpdatedAt', 'LastLocationUpdatedAt') ?? null,
  };
}

export function parseCommunityMembersResponse(data: unknown): CommunityMemberDto[] {
  return parseList<unknown>(data, 'members', 'Members', 'items', 'Items').map(normalizeLegacyMember);
}

export function parseMemberDetailResponse(data: unknown): MemberDetailDto[] {
  return parseList<unknown>(data, 'members', 'Members', 'items', 'Items').map(normalizeMemberDetail);
}

export function parseJoinRequestsResponse(data: unknown): JoinRequestDto[] {
  return parseList<unknown>(data, 'joinRequests', 'JoinRequests', 'items', 'Items').map((raw) => {
    const obj = asRecord(raw);
    return {
      memberId: pick<string>(obj, 'memberId', 'MemberId') ?? '',
      userId: pick<string>(obj, 'userId', 'UserId', 'usrId', 'UsrId') ?? '',
      userName: pick<string>(obj, 'userName', 'UserName') ?? '—',
      profilePhotoUrl: pick<string>(obj, 'profilePhotoUrl', 'ProfilePhotoUrl'),
      requestedAt: pick<string>(obj, 'requestedAt', 'RequestedAt') ?? '',
      status: parseJoinStatus(pick(obj, 'status', 'Status')),
    };
  });
}

export function parseCommunitySearchResponse(data: unknown): CommunitySearchResultDto[] {
  return parseList<unknown>(data, 'communities', 'Communities', 'items', 'Items').map((raw) => {
    const obj = asRecord(raw);
    const typeNum = normalizeCommunityType(pick(obj, 'communityType', 'CommunityType'));
    const typeNames = ['Neighborhood', 'Building', 'PrivateGroup'] as const;
    const rawJoinStatus = pick(obj, 'myJoinStatus', 'MyJoinStatus');
    return {
      id: pick<string>(obj, 'id', 'Id') ?? '',
      name: pick<string>(obj, 'name', 'Name') ?? '—',
      description: pick<string>(obj, 'description', 'Description'),
      communityType: typeNames[typeNum],
      memberCount: Number(pick(obj, 'memberCount', 'MemberCount') ?? 0),
      coverageRadiusMeters: pick<number>(obj, 'coverageRadiusMeters', 'CoverageRadiusMeters'),
      acceptsJoinRequests: Boolean(pick(obj, 'acceptsJoinRequests', 'AcceptsJoinRequests') ?? false),
      hasActiveInviteCode: Boolean(pick(obj, 'hasActiveInviteCode', 'HasActiveInviteCode') ?? false),
      isAlreadyMember: Boolean(pick(obj, 'isAlreadyMember', 'IsAlreadyMember') ?? false),
      myJoinStatus: rawJoinStatus != null ? parseJoinStatus(rawJoinStatus) : null,
    };
  });
}

export function parseNearbyCommunitiesResponse(data: unknown): NearbyCommunityDto[] {
  return parseList<unknown>(data, 'items', 'Items', 'communities', 'Communities').map((raw) => {
    const obj = asRecord(raw);
    return {
      id: pick<string>(obj, 'id', 'Id') ?? '',
      name: pick<string>(obj, 'name', 'Name') ?? '—',
      communityType: normalizeCommunityType(pick(obj, 'communityType', 'CommunityType')),
      coverageRadiusMeters: pick<number | null>(obj, 'coverageRadiusMeters', 'CoverageRadiusMeters') ?? null,
      distanceMeters: Number(pick(obj, 'distanceMeters', 'DistanceMeters') ?? 0),
      memberCount: Number(pick(obj, 'memberCount', 'MemberCount') ?? 0),
    };
  });
}

export function parseCommunityDetail(data: unknown, currentUserId?: string): CommunityDetailDto {
  const obj = asRecord(data);
  const typeRaw = pick(obj, 'communityType', 'CommunityType');
  const rawRole = pick(obj, 'myRole', 'MyRole', 'communityRole', 'CommunityRole');
  const membersEmbedded = parseList<unknown>(obj, 'members', 'Members').map(normalizeMemberDetail);

  let myRole =
    rawRole != null
      ? parseCommunityRole(rawRole, pick(obj, 'communityRoleName', 'CommunityRoleName'))
      : null;
  if (!myRole && currentUserId) {
    myRole = myMembership(membersEmbedded, currentUserId)?.role ?? null;
  }
  if (!myRole && currentUserId) {
    const createdById = pick<string>(obj, 'createdById', 'CreatedById');
    if (createdById?.trim().toLowerCase() === currentUserId.trim().toLowerCase()) {
      myRole = 'Owner';
    }
  }

  const totalMemberCount = Number(
    pick(obj, 'totalMemberCount', 'TotalMemberCount', 'memberCount', 'MemberCount') ?? membersEmbedded.length,
  );

  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    name: pick<string>(obj, 'name', 'Name') ?? '—',
    description: pick<string>(obj, 'description', 'Description') ?? null,
    communityType: normalizeCommunityType(typeRaw),
    communityTypeName: pick<CommunityTypeName>(
      obj,
      'communityTypeName',
      'CommunityTypeName',
    ),
    memberCount: totalMemberCount,
    totalMemberCount,
    activeMemberCount: Number(pick(obj, 'activeMemberCount', 'ActiveMemberCount') ?? 0),
    locationPendingCount: Number(pick(obj, 'locationPendingCount', 'LocationPendingCount') ?? 0),
    inactiveMemberCount: Number(pick(obj, 'inactiveMemberCount', 'InactiveMemberCount') ?? 0),
    sosReadinessPercent: Number(pick(obj, 'sosReadinessPercent', 'SosReadinessPercent') ?? 0),
    createdById: pick<string>(obj, 'createdById', 'CreatedById') ?? null,
    createdByName: pick<string>(obj, 'createdByName', 'CreatedByName') ?? '—',
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    isArchived: Boolean(pick(obj, 'isArchived', 'IsArchived') ?? false),
    inviteCode: pick<string>(obj, 'inviteCode', 'InviteCode') ?? null,
    inviteCodeExpiresAt: pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
    coverageRadiusMeters:
      pick<number | null>(obj, 'coverageRadiusMeters', 'CoverageRadiusMeters') ?? null,
    centroidLatitude: pick<number | null>(obj, 'centroidLatitude', 'CentroidLatitude') ?? null,
    centroidLongitude: pick<number | null>(obj, 'centroidLongitude', 'CentroidLongitude') ?? null,
    pendingJoinRequestCount: Number(
      pick(obj, 'pendingJoinRequestCount', 'PendingJoinRequestCount', 'pendingRequestCount', 'PendingRequestCount') ?? 0,
    ),
    myRole,
    members: membersEmbedded.length > 0 ? membersEmbedded : undefined,
  };
}

function normalizeCommunityId(id: string): string {
  return id.trim().toLowerCase();
}

function asResponseObject(data: unknown): Record<string, unknown> {
  const body = unwrapApiBody(data);
  if (typeof body === 'string') {
    return { inviteCode: body, newInviteCode: body };
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

export function parseRegenerateCodeResponse(
  data: unknown,
  fallbackCommunityId?: string,
): RegenerateCodeResponse {
  const obj = asResponseObject(data);
  const code =
    pick<string>(obj, 'newInviteCode', 'NewInviteCode', 'inviteCode', 'InviteCode') ?? '';
  const communityId =
    pick<string>(obj, 'communityId', 'CommunityId') ?? fallbackCommunityId ?? '';
  return {
    communityId,
    newInviteCode: code,
    inviteCode: code,
    inviteCodeExpiresAt:
      pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
  };
}

const knownInviteCodes = new Map<
  string,
  { inviteCode: string; inviteCodeExpiresAt: string | null }
>();

export function rememberCommunityInviteCode(
  communityId: string,
  inviteCode: string,
  inviteCodeExpiresAt?: string | null,
) {
  const id = normalizeCommunityId(communityId);
  if (!id || !inviteCode) return;
  knownInviteCodes.set(id, {
    inviteCode,
    inviteCodeExpiresAt: inviteCodeExpiresAt ?? null,
  });
}

export function forgetCommunityInviteCode(communityId: string) {
  knownInviteCodes.delete(normalizeCommunityId(communityId));
}

export function resolveCommunityInviteCode(
  communityId: string,
  fromApi?: string | null,
): string | null {
  const id = normalizeCommunityId(communityId);
  if (fromApi) {
    rememberCommunityInviteCode(id, fromApi);
    return fromApi;
  }
  return knownInviteCodes.get(id)?.inviteCode ?? null;
}

export function resolveCommunityInviteCodeExpiresAt(
  communityId: string,
  fromApi?: string | null,
): string | null {
  const id = normalizeCommunityId(communityId);
  if (fromApi) return fromApi;
  return knownInviteCodes.get(id)?.inviteCodeExpiresAt ?? null;
}

export function patchCommunityInviteCodeInCache(
  qc: QueryClient,
  communityId: string,
  inviteCode: string,
  inviteCodeExpiresAt?: string | null,
) {
  rememberCommunityInviteCode(communityId, inviteCode, inviteCodeExpiresAt);

  const targetId = normalizeCommunityId(communityId);
  const patchList = (list: Array<{ id: string; inviteCode?: string | null; inviteCodeExpiresAt?: string | null }>) =>
    list.map((c) =>
      normalizeCommunityId(c.id) === targetId
        ? {
            ...c,
            inviteCode,
            inviteCodeExpiresAt: inviteCodeExpiresAt ?? c.inviteCodeExpiresAt ?? null,
          }
        : c,
    );

  qc.setQueriesData({ queryKey: ['communities'] }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;
    const parsed = old as { communities?: Array<{ id: string }> };
    if (!parsed.communities) return old;
    return { ...parsed, communities: patchList(parsed.communities) };
  });

  qc.setQueriesData({ queryKey: ['admin', 'communities'] }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;
    const parsed = old as { communities?: Array<{ id: string }> };
    if (!parsed.communities) return old;
    return { ...parsed, communities: patchList(parsed.communities) };
  });

  qc.setQueriesData({ queryKey: communityKeys.myList() }, (old: unknown) => {
    if (Array.isArray(old)) return patchList(old);
    if (old && typeof old === 'object') {
      const parsed = old as { communities?: Array<{ id: string }> };
      if (parsed.communities) {
        return { ...parsed, communities: patchList(parsed.communities) };
      }
    }
    return old;
  });

  qc.setQueriesData({ queryKey: communityKeys.my() }, (old: unknown) => {
    if (Array.isArray(old)) return patchList(old);
    if (old && typeof old === 'object') {
      const parsed = old as { communities?: Array<{ id: string }> };
      if (parsed.communities) {
        return { ...parsed, communities: patchList(parsed.communities) };
      }
    }
    return old;
  });
}

export type CommunityListParams = {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  communityType?: number;
};

export type CommunitySearchParams = {
  /** API accepts `name` query param */
  name?: string;
  nameQuery?: string;
  /** 0 = Neighborhood, 1 = Building */
  type?: number;
  radiusKm?: number;
};

export function parseCreateCommunityResponse(data: unknown): CreateCommunityResponse {
  const obj = asRecord(data);
  const id = pick<string>(obj, 'id', 'Id') ?? '';
  const code = pick<string>(obj, 'inviteCode', 'InviteCode', 'newInviteCode', 'NewInviteCode') ?? null;
  const expires = pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null;
  if (id && code) rememberCommunityInviteCode(id, code, expires);

  return {
    id,
    name: pick<string>(obj, 'name', 'Name') ?? '',
    description: pick<string>(obj, 'description', 'Description') ?? null,
    communityType: normalizeCommunityType(pick(obj, 'communityType', 'CommunityType')),
    coverageRadiusMeters:
      pick<number | null>(obj, 'coverageRadiusMeters', 'CoverageRadiusMeters') ?? null,
    createdById: pick<string>(obj, 'createdById', 'CreatedById') ?? '',
    userName: pick<string>(obj, 'userName', 'UserName') ?? '',
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    inviteCode: code,
    inviteCodeExpiresAt: expires,
    userDetails: (pick(obj, 'userDetails', 'UserDetails') ?? {}) as CreateCommunityResponse['userDetails'],
  };
}

export const communityApi = {
  getAll: (params: CommunityListParams = {}) =>
    apiClient.get('/api/Community/all', { params }).then((r) => unwrapApiBody(r.data)),

  getById: async (communityId: string, currentUserId?: string): Promise<CommunityDetailDto> => {
    try {
      const res = await apiClient.get(`/api/Community/${communityId}`);
      return parseCommunityDetail(unwrapApiBody(res.data), currentUserId);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) throw err;
      const res = await apiClient.get('/api/Community/all', {
        params: { pageNumber: 1, pageSize: 1000 },
      });
      const body = asRecord(unwrapApiBody(res.data));
      const list =
        body.communities ?? body.Communities ?? body.items ?? body.Items ?? [];
      if (Array.isArray(list)) {
        const found = list.find(
          (item) =>
            normalizeCommunityId(String(asRecord(item).id ?? asRecord(item).Id ?? '')) ===
            normalizeCommunityId(communityId),
        );
        if (found) return parseCommunityDetail(found, currentUserId);
      }
      throw new Error('Community not found');
    }
  },

  search: (params: CommunitySearchParams = {}) => {
    const query: Record<string, string | number> = {};
    const name = params.name ?? params.nameQuery;
    if (name) query.name = name;
    if (params.type != null) query.type = params.type;
    if (params.radiusKm != null) query.radiusKm = params.radiusKm;
    return apiClient
      .get('/api/Community/search', { params: query })
      .then((r) => parseCommunitySearchResponse(unwrapApiBody(r.data)));
  },

  submitJoinRequest: (communityId: string) =>
    apiClient
      .post(`/api/Community/${communityId}/join-request`)
      .then((r) => r.data as CommunityJoinResultDto),

  getJoinRequests: (communityId: string) =>
    apiClient
      .get(`/api/Community/${communityId}/join-requests`)
      .then((r) => parseJoinRequestsResponse(unwrapApiBody(r.data))),

  approveJoinRequest: (communityId: string, userId: string) =>
    apiClient.put(`/api/Community/${communityId}/join-requests/${userId}/approve`),

  rejectJoinRequest: (communityId: string, userId: string) =>
    apiClient.put(`/api/Community/${communityId}/join-requests/${userId}/reject`),

  getMembers: (communityId: string) =>
    apiClient
      .get(`/api/Community/${communityId}/members`)
      .then((r) => parseMemberDetailResponse(unwrapApiBody(r.data))),

  /** Members from /members, or embedded on GET /{id} when that endpoint returns empty */
  getMembersOrFromDetail: async (communityId: string, currentUserId?: string) => {
    try {
      const res = await apiClient.get(`/api/Community/${communityId}/members`);
      const members = parseMemberDetailResponse(unwrapApiBody(res.data));
      if (members.length > 0) return members;
    } catch {
      /* fall through */
    }
    const res = await apiClient.get(`/api/Community/${communityId}`);
    return parseCommunityDetail(unwrapApiBody(res.data), currentUserId).members ?? [];
  },

  kickMember: (communityId: string, userId: string) =>
    apiClient.delete(`/api/Community/${communityId}/members/${userId}`),

  changeMemberRole: (
    communityId: string,
    userId: string,
    newRole: 'Member' | 'Moderator' | 'Admin',
  ) =>
    apiClient.put(`/api/Community/${communityId}/members/${userId}/role`, communityRoleToInt(newRole), {
      headers: { 'Content-Type': 'application/json' },
    }),

  transferOwnership: (communityId: string, newOwnerUserId: string) =>
    apiClient.post(`/api/Community/${communityId}/transfer-ownership`, JSON.stringify(newOwnerUserId), {
      headers: { 'Content-Type': 'application/json' },
    }),

  archiveCommunity: (communityId: string) =>
    apiClient.delete(`/api/Community/${communityId}`),

  deleteCommunity: (communityId: string) =>
    apiClient.delete(`/api/Community/${communityId}`),

  bulkRegenerateInviteCodes: () =>
    apiClient.post('/api/Community/admin/regenerate-all-codes').then((r) => {
      const obj = asRecord(r.data);
      const updated = Number(pick(obj, 'updatedCommunities', 'UpdatedCommunities') ?? 0);
      const count = Number(pick(obj, 'count', 'Count') ?? updated);
      return {
        count: count || updated,
        updatedCommunities: updated || count,
        message: pick<string>(obj, 'message', 'Message'),
      } satisfies BulkRegenerateInviteCodesResponse;
    }),

  regenerateInviteCode: (communityId: string) =>
    apiClient
      .post(`/api/Community/${communityId}/regenerate-code`)
      .then((r) => parseRegenerateCodeResponse(unwrapApiBody(r.data), communityId)),

  /** Citizen — my joined communities */
  getMyCommunities: (currentUserId?: string) =>
    apiClient
      .get('/api/Community')
      .then((r) => parseMyCommunitiesResponse(unwrapApiBody(r.data), currentUserId)),

  updateCommunity: (communityId: string, payload: CreateCommunityRequest) =>
    apiClient
      .put(`/api/Community/${communityId}`, payload)
      .then((r) => parseCommunityDetail(unwrapApiBody(r.data))),

  getNearby: (radiusKm = 1) =>
    apiClient
      .get('/api/Community/nearby', { params: { radiusKm } })
      .then((r) => parseNearbyCommunitiesResponse(unwrapApiBody(r.data))),

  joinByInviteCode: (inviteCode: string) =>
    apiClient
      .post('/api/Community/join', {
        inviteCode: inviteCode.trim().toUpperCase(),
      })
      .then((r) => {
        const raw = asRecord(unwrapApiBody(r.data));
        const memberStatusRaw = pick(raw, 'memberStatus', 'MemberStatus');
        const requiresLocation =
          raw.requiresLocation === true ||
          raw.requiresLocationSetup === true ||
          parseMemberLocationStatus(memberStatusRaw) === 'LocationPending';
        return {
          communityId: pick<string>(raw, 'communityId', 'CommunityId') ?? '',
          communityName: pick<string>(raw, 'communityName', 'CommunityName') ?? '',
          memberStatus: parseMemberLocationStatus(memberStatusRaw),
          message: pick<string>(raw, 'message', 'Message') ?? '',
          requiresLocation,
        } satisfies JoinCommunityResponse;
      }),

  leaveCommunity: (communityId: string) =>
    apiClient.post(`/api/Community/${communityId}/leave`),

  revokeInviteCode: (communityId: string) =>
    apiClient.delete(`/api/Community/${communityId}/invite-code`),

  /** Citizen — create a new community (becomes Owner) */
  createCommunity: (payload: CreateCommunityRequest) =>
    apiClient.post('/api/Community', payload).then((r) => parseCreateCommunityResponse(unwrapApiBody(r.data))),
};
