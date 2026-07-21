import type { CommunityRoleName, JoinStatus, MemberDetailDto } from '../types/community';
import type { CommunityType } from '../types';
import type { CommunitySearchResultDto } from '../types/community';
import { parseCommunityRole } from './communityEnums';

export function joinStatusLabel(status?: JoinStatus | null): string {
  switch (status) {
    case 'Pending':
      return 'Request Pending — waiting for admin approval';
    case 'Approved':
      return 'Member';
    case 'Rejected':
      return 'Request Rejected';
    case 'Banned':
      return 'Banned from community';
    default:
      return 'Not a member';
  }
}

export function canManageMembers(role?: CommunityRoleName | string | null): boolean {
  return role === 'Owner' || role === 'Admin';
}

/** Owner/Admin, or creator when API omits role on list/detail */
export function canManageCommunity(
  role?: CommunityRoleName | string | null,
  createdById?: string | null,
  userId?: string,
): boolean {
  if (canManageMembers(role)) return true;
  if (createdById && userId && createdById.trim() === userId.trim()) return true;
  return false;
}

export function canChangeRoles(role?: CommunityRoleName | string | null): boolean {
  return role === 'Owner';
}

/** Resolve the signed-in user's role from detail, list row, members, or creator id. */
export function resolveEffectiveRole(
  userId: string,
  sources: {
    communityRole?: CommunityRoleName | string | null;
    createdById?: string | null;
    members?: MemberDetailDto[];
    listRole?: CommunityRoleName | string | null;
    listCreatedById?: string | null;
  },
): CommunityRoleName | null {
  if (!userId?.trim()) return null;
  const uid = userId.trim().toLowerCase();

  const memberRow = sources.members?.find((m) => m.userId.trim().toLowerCase() === uid);
  if (memberRow?.role && memberRow.role !== 'Member') return memberRow.role;
  if (sources.communityRole) return parseCommunityRole(sources.communityRole);
  if (sources.listRole) return parseCommunityRole(sources.listRole);
  if (memberRow?.role) return memberRow.role;

  const creator = sources.createdById ?? sources.listCreatedById;
  if (creator && creator.trim().toLowerCase() === uid) return 'Owner';
  return null;
}

export function canViewInviteCode(
  role: CommunityRoleName | null,
  createdById: string | null | undefined,
  userId: string,
  isPlatformAdmin: boolean,
): boolean {
  return isPlatformAdmin || canManageCommunity(role, createdById, userId);
}

export function myMembership(
  members: MemberDetailDto[],
  userId: string,
): MemberDetailDto | undefined {
  if (!userId) return undefined;
  const id = userId.trim().toLowerCase();
  return members.find((m) => m.userId.trim().toLowerCase() === id);
}

export function communityTypeFromSearch(type: CommunitySearchResultDto['communityType']): CommunityType {
  switch (type) {
    case 'Building':
      return 1;
    case 'PrivateGroup':
      return 2;
    default:
      return 0;
  }
}
