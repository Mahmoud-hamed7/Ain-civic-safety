import type { CitizenCommunityDto } from '../types/community';
import { normalizeCommunityType } from './communities';
import { parseCommunityRole, parseJoinStatus, parseMemberLocationStatus } from './communityEnums';
import { asRecord, pick, unwrapApiBody } from './apiBody';

function memberUserId(raw: unknown): string {
  const obj = asRecord(raw);
  return pick<string>(obj, 'usrId', 'UsrId', 'userId', 'UserId') ?? '';
}

export function normalizeCitizenCommunity(raw: unknown, currentUserId?: string): CitizenCommunityDto {
  const obj = asRecord(raw);
  const members = Array.isArray(obj.members)
    ? obj.members
  : Array.isArray(obj.Members)
    ? obj.Members
    : [];

  const rawJoin = pick(obj, 'myJoinStatus', 'MyJoinStatus', 'joinStatus', 'JoinStatus');
  const rawMember = pick(obj, 'userMemberStatus', 'UserMemberStatus', 'memberStatus', 'MemberStatus');
  const rawRole = pick(obj, 'myRole', 'MyRole', 'communityRole', 'CommunityRole', 'role', 'Role');

  let myRole =
    rawRole != null
      ? parseCommunityRole(rawRole, pick(obj, 'communityRoleName', 'CommunityRoleName'))
      : null;

  if (!myRole && currentUserId && members.length > 0) {
    const me = members.find(
      (m) => memberUserId(m).toLowerCase() === currentUserId.trim().toLowerCase(),
    );
    if (me) {
      myRole = parseCommunityRole(
        pick(asRecord(me), 'role', 'Role', 'communityRole', 'CommunityRole'),
        pick(asRecord(me), 'communityRoleName', 'CommunityRoleName'),
      );
    }
  }

  const createdById = pick<string>(obj, 'createdById', 'CreatedById') ?? null;
  if (!myRole && currentUserId && createdById?.trim().toLowerCase() === currentUserId.trim().toLowerCase()) {
    myRole = 'Owner';
  }

  const memberCount = Number(
    pick(
      obj,
      'totalMemberCount',
      'TotalMemberCount',
      'memberCount',
      'MemberCount',
      'activeMemberCount',
      'ActiveMemberCount',
    ) ?? members.length,
  );

  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    name: pick<string>(obj, 'name', 'Name') ?? '—',
    description: pick<string>(obj, 'description', 'Description') ?? null,
    communityType: normalizeCommunityType(pick(obj, 'communityType', 'CommunityType')),
    memberCount,
    createdById,
    createdByName: pick<string>(obj, 'createdByName', 'CreatedByName'),
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt'),
    centroidLatitude: pick<number | null>(obj, 'centroidLatitude', 'CentroidLatitude') ?? null,
    centroidLongitude: pick<number | null>(obj, 'centroidLongitude', 'CentroidLongitude') ?? null,
    inviteCode: pick<string>(obj, 'inviteCode', 'InviteCode') ?? null,
    inviteCodeExpiresAt: pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
    userMemberStatus: parseMemberLocationStatus(rawMember),
    myJoinStatus: rawJoin != null ? parseJoinStatus(rawJoin) : myRole ? 'Approved' : null,
    myRole,
    pendingJoinRequestCount: Number(
      pick(obj, 'pendingJoinRequestCount', 'PendingJoinRequestCount') ?? 0,
    ),
  };
}

export function parseMyCommunitiesResponse(data: unknown, currentUserId?: string): CitizenCommunityDto[] {
  const body = unwrapApiBody(data);

  if (Array.isArray(body)) {
    return body.map((item) => normalizeCitizenCommunity(item, currentUserId));
  }

  const obj = asRecord(body);
  const list =
    obj.communities ??
    obj.Communities ??
    obj.items ??
    obj.Items ??
    obj.data ??
    obj.Data;

  if (Array.isArray(list)) {
    return list.map((item) => normalizeCitizenCommunity(item, currentUserId));
  }

  if (pick<string>(obj, 'id', 'Id')) {
    return [normalizeCitizenCommunity(obj, currentUserId)];
  }

  return [];
}

export function canTriggerSOS(c: CitizenCommunityDto): boolean {
  if (c.myJoinStatus && c.myJoinStatus !== 'Approved') return false;
  return c.userMemberStatus === 'Active';
}

export function hasPendingLocation(c: CitizenCommunityDto): boolean {
  return c.userMemberStatus === 'LocationPending';
}

export function selectSOSCommunity(communities: CitizenCommunityDto[]): CitizenCommunityDto | undefined {
  return communities.find(canTriggerSOS);
}

export function hasAnyLocationPending(communities: CitizenCommunityDto[]): boolean {
  return communities.some(hasPendingLocation);
}
