/** Community module v3 types */

export type JoinStatus = 'Pending' | 'Approved' | 'Rejected' | 'Banned';
export type CommunityRoleName = 'Member' | 'Moderator' | 'Admin' | 'Owner';
export type CommunityTypeName = 'Neighborhood' | 'Building' | 'PrivateGroup';

export interface CommunitySearchResultDto {
  id: string;
  name: string;
  description?: string;
  communityType: CommunityTypeName;
  memberCount: number;
  coverageRadiusMeters?: number;
  acceptsJoinRequests: boolean;
  hasActiveInviteCode: boolean;
  isAlreadyMember: boolean;
  myJoinStatus?: JoinStatus | null;
}

export interface CitizenCommunityDto {
  id: string;
  name: string;
  description: string | null;
  communityType: number;
  memberCount: number;
  createdById: string | null;
  createdByName?: string;
  createdAt?: string;
  centroidLatitude?: number | null;
  centroidLongitude?: number | null;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: string | null;
  userMemberStatus: 'Active' | 'LocationPending' | 'Inactive';
  myJoinStatus: JoinStatus | null;
  myRole: CommunityRoleName | null;
  pendingJoinRequestCount?: number;
}

export interface CommunityJoinResultDto {
  communityId: string;
  communityName?: string;
  status?: JoinStatus;
  message?: string;
  memberStatus?: number | string;
  requiresLocation?: boolean;
  requiresLocationSetup?: boolean;
}

export interface JoinRequestDto {
  memberId: string;
  userId: string;
  userName: string;
  profilePhotoUrl?: string;
  requestedAt: string;
  status: JoinStatus;
}

export interface MemberDetailDto {
  userId: string;
  userName: string;
  role: CommunityRoleName;
  joinStatus: JoinStatus;
  joinedAt: string;
  email?: string;
  phoneNumber?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  lastLocationUpdatedAt?: string | null;
}

export interface BulkRegenerateInviteCodesResponse {
  count: number;
  updatedCommunities?: number;
  message?: string;
}

export interface CommunityDetailDto {
  id: string;
  name: string;
  description: string | null;
  communityType: CommunityTypeName | number;
  memberCount: number;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  isArchived?: boolean;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: string | null;
  centroidLatitude?: number | null;
  centroidLongitude?: number | null;
  coverageRadiusMeters?: number | null;
  pendingJoinRequestCount?: number;
  myRole?: CommunityRoleName | null;
  /** Embedded on GET /api/Community/{id} */
  members?: MemberDetailDto[];
  activeMemberCount?: number;
  locationPendingCount?: number;
  inactiveMemberCount?: number;
  totalMemberCount?: number;
  sosReadinessPercent?: number;
  communityTypeName?: CommunityTypeName;
}

export interface ApiError {
  statusCode: number;
  message: string;
  detail?: string;
}
