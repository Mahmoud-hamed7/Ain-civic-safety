import type { CommunityRoleName, JoinStatus } from '../types/community';

/** API integer enums — confirmed in endpoint testing guide */
const JOIN_STATUS_INT: Record<number, JoinStatus> = {
  0: 'Pending',
  1: 'Approved',
  2: 'Rejected',
  3: 'Banned',
};

const JOIN_STATUS_STR: Record<string, JoinStatus> = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Banned: 'Banned',
};

const ROLE_INT: Record<number, CommunityRoleName> = {
  0: 'Member',
  1: 'Moderator',
  2: 'Admin',
  3: 'Owner',
};

const ROLE_STR: Record<string, CommunityRoleName> = {
  Member: 'Member',
  Moderator: 'Moderator',
  Admin: 'Admin',
  Owner: 'Owner',
};

export function parseJoinStatus(raw: unknown): JoinStatus {
  if (typeof raw === 'number' && raw in JOIN_STATUS_INT) return JOIN_STATUS_INT[raw];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed in JOIN_STATUS_STR) return JOIN_STATUS_STR[trimmed];
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum in JOIN_STATUS_INT) return JOIN_STATUS_INT[asNum];
  }
  return 'Pending';
}

export function parseCommunityRole(raw: unknown, nameFallback?: unknown): CommunityRoleName {
  if (typeof nameFallback === 'string' && nameFallback in ROLE_STR) {
    return ROLE_STR[nameFallback];
  }
  if (typeof raw === 'number' && raw in ROLE_INT) return ROLE_INT[raw];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed in ROLE_STR) return ROLE_STR[trimmed];
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum in ROLE_INT) return ROLE_INT[asNum];
  }
  return 'Member';
}

export function communityRoleToInt(role: CommunityRoleName): number {
  switch (role) {
    case 'Moderator':
      return 1;
    case 'Admin':
      return 2;
    case 'Owner':
      return 3;
    default:
      return 0;
  }
}

export type MemberLocationStatus = 'Active' | 'LocationPending' | 'Inactive';

const MEMBER_STATUS_INT: Record<number, MemberLocationStatus> = {
  0: 'LocationPending',
  1: 'Active',
  2: 'Inactive',
};

export function parseMemberLocationStatus(raw: unknown): MemberLocationStatus {
  if (typeof raw === 'number' && raw in MEMBER_STATUS_INT) return MEMBER_STATUS_INT[raw];
  if (typeof raw === 'string') {
    if (raw === 'Active' || raw === 'LocationPending' || raw === 'Inactive') return raw;
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum in MEMBER_STATUS_INT) return MEMBER_STATUS_INT[asNum];
  }
  return 'Active';
}

export function joinStatusLabel(status: JoinStatus): string {
  switch (status) {
    case 'Pending':
      return 'Pending';
    case 'Approved':
      return 'Approved';
    case 'Rejected':
      return 'Rejected';
    case 'Banned':
      return 'Banned';
    default:
      return String(status);
  }
}
