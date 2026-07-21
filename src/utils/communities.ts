import type { CommunitySystemListDto, CommunityType, CommunityTypeName } from '../types';
import {
  resolveCommunityInviteCode,
  resolveCommunityInviteCodeExpiresAt,
} from '../api/community';
import { asRecord, pick, unwrapApiBody } from './apiBody';

const STRING_TYPE_TO_NUM: Record<string, CommunityType> = {
  Neighborhood: 0,
  Building: 1,
  PrivateGroup: 2,
  Private: 2,
};

const NUM_TYPE_TO_LABEL: Record<CommunityType, CommunityTypeName> = {
  0: 'Neighborhood',
  1: 'Building',
  2: 'PrivateGroup',
};

export function normalizeCommunityType(raw: unknown): CommunityType {
  if (typeof raw === 'number' && raw >= 0 && raw <= 2) return raw as CommunityType;
  if (typeof raw === 'string') {
    const key = raw.trim();
    if (key in STRING_TYPE_TO_NUM) return STRING_TYPE_TO_NUM[key];
    const asNum = Number(key);
    if (Number.isFinite(asNum) && asNum >= 0 && asNum <= 2) return asNum as CommunityType;
  }
  return 0;
}

export function communityTypeLabel(type?: CommunityType): CommunityTypeName {
  return NUM_TYPE_TO_LABEL[type ?? 0];
}

export function isNeighborhoodCommunity(type?: CommunityType): boolean {
  return normalizeCommunityType(type) === 0;
}

export function normalizeCommunityListItem(raw: unknown): CommunitySystemListDto {
  const obj = asRecord(raw);
  const lat = pick<number | null>(obj, 'centroidLatitude', 'CentroidLatitude');
  const lng = pick<number | null>(obj, 'centroidLongitude', 'CentroidLongitude');

  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    name: pick<string>(obj, 'name', 'Name') ?? '—',
    description: pick<string>(obj, 'description', 'Description') ?? null,
    communityType: normalizeCommunityType(pick(obj, 'communityType', 'CommunityType')),
    memberCount: Number(pick(obj, 'memberCount', 'MemberCount') ?? 0),
    createdById: pick<string>(obj, 'createdById', 'CreatedById') ?? null,
    createdByName:
      pick<string>(obj, 'createdByName', 'CreatedByName', 'creatorName', 'CreatorName') ?? '—',
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    lastModifiedAt: pick<string>(obj, 'lastModifiedAt', 'LastModifiedAt') ?? null,
    centroidLatitude: lat ?? null,
    centroidLongitude: lng ?? null,
    isWithinCallerJurisdiction: Boolean(
      pick(obj, 'isWithinCallerJurisdiction', 'IsWithinCallerJurisdiction') ?? false,
    ),
    inviteCode: pick<string>(obj, 'inviteCode', 'InviteCode') ?? null,
    inviteCodeExpiresAt: pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
    inviteCodeUsedCount: Number(pick(obj, 'inviteCodeUsedCount', 'InviteCodeUsedCount') ?? 0),
    inviteCodeMaxUses: Number(pick(obj, 'inviteCodeMaxUses', 'InviteCodeMaxUses') ?? 0),
    myRole: pick<string>(obj, 'myRole', 'MyRole', 'callerRole', 'CallerRole') ?? null,
    isArchived: Boolean(pick(obj, 'isArchived', 'IsArchived') ?? false),
    pendingJoinRequestCount: Number(
      pick(obj, 'pendingJoinRequestCount', 'PendingJoinRequestCount', 'pendingRequestCount', 'PendingRequestCount') ?? 0,
    ),
  };
}

function mergeKnownInviteCodes(communities: CommunitySystemListDto[]): CommunitySystemListDto[] {
  return communities.map((c) => ({
    ...c,
    inviteCode: resolveCommunityInviteCode(c.id, c.inviteCode),
    inviteCodeExpiresAt: resolveCommunityInviteCodeExpiresAt(c.id, c.inviteCodeExpiresAt),
  }));
}

export function parseCommunityAdminResponse(data: unknown): {
  communities: CommunitySystemListDto[];
  totalCount: number;
  totalPages: number;
  pageNumber: number;
} {
  const body = asRecord(unwrapApiBody(data));
  const rawList =
    body.items ??
    body.Items ??
    body.communities ??
    body.Communities ??
    body.data ??
    body.Data ??
    (Array.isArray(unwrapApiBody(data)) ? unwrapApiBody(data) : []);

  const communities = mergeKnownInviteCodes(
    Array.isArray(rawList) ? rawList.map(normalizeCommunityListItem) : [],
  );

  const apiTotal = Number(
    pick(body, 'totalCount', 'TotalCount', 'count', 'Count') ?? NaN,
  );
  const totalCount =
    Number.isFinite(apiTotal) && apiTotal > 0 ? apiTotal : communities.length;
  const apiPages = Number(pick(body, 'totalPages', 'TotalPages') ?? NaN);
  const pageSize = Number(pick(body, 'pageSize', 'PageSize') ?? 20);
  const pageNumber = Number(pick(body, 'pageNumber', 'PageNumber', 'page', 'Page') ?? 1);
  const totalPages =
    Number.isFinite(apiPages) && apiPages > 0
      ? apiPages
      : Math.max(1, Math.ceil(totalCount / pageSize));

  return { communities, totalCount, totalPages, pageNumber };
}

export function shortCommunityId(id: string): string {
  return id ? id.slice(-8) : '';
}
