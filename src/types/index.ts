// ─────────────────────────────────────────────────────────────
//  AIN Frontend — Shared TypeScript Types (v2)
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: string | string[];
  token: string;
  profilePhotoUrl?: string;
  trustPoints?: number;
  badge?: 'Newcomer' | 'Contributor' | 'Trusted' | 'Guardian';
  authorityId?: string;
}

export interface AuthResult {
  isSuccess: boolean;
  errors: Record<string, string[]>;
  user: {
    displayName: string;
    email: string;
    token: string;
    refreshToken: string;
  } | null;
  message: string | null;
  signupToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// ── Enums ──────────────────────────────────────────────────────
export type ReportStatus     = 'UnderReview' | 'Dispatched' | 'ReSolved' | 'Rejected';
export type ReportVisibility = 'Public' | 'Confidential' | 'Anonymous';
export type SOSStatus        = 'Active' | 'Resolved' | 'Cancelled' | 'FalseAlarm' | 'Expired';
export type SOSSeverity      = 'Standard' | 'High' | 'Critical';
export type TrustBadge       = 'Newcomer' | 'Contributor' | 'Trusted' | 'Guardian';
export type CommunityType    = 0 | 1 | 2;   // 0=Neighborhood, 1=Building, 2=PrivateGroup
export type MemberStatus     = 'Active' | 'LocationPending' | 'Inactive'; // ⭐ v2

// ── Report types ────────────────────────────────────────────────
export interface ReportLocation {
  latitude: number;
  longitude: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  contentType: string | null;
  fileSize: string;
  aiValidated: boolean;
}

export interface ReporterDetails {
  id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  nationalId: string | null;
  idCardUrl: string | null;
  idCardBackUrl: string | null;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  status: ReportStatus | 'Resolved'; // 'Resolved' alias kept for compat
  visibility: ReportVisibility;
  category: string;
  subCategory: string;
  authorityName: string | null;
  createdAt: string;
  attachments: Attachment[];
  location: ReportLocation;
  locationName: string | null;
  locationMapUrl: string | null;
  reporter: ReporterDetails | null;
}

/** GET /api/Reports/authority-feed paginated wrapper */
export interface AuthorityFeedResponse {
  callerAuthorityName: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  reports: Report[];
}

export interface ReportMapPinDto {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  locationMapUrl: string;
  title: string;
  status: string;
  visibility: string;
  subcategoryName: string | null;
  categoryName: string | null;
  createdAt: string;
}

// ── Authority types ─────────────────────────────────────────────
export interface AuthoritySpecializationItem {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName?: string | null;
}

export interface AuthorityCoverageArea {
  id: string;
  areaName: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
}

export interface AuthorityProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  status: number; // 1 = Active, 0 = Inactive
  userId: string | null;
  latitude: number | null;
  longitude: number | null;
  jurisdictionRadiusKm: number | null;
  createdAt: string;
  specializations: AuthoritySpecializationItem[];
  coverageAreas?: AuthorityCoverageArea[];
}

/** @deprecated Use AuthorityProfile — kept for existing authority pages */
export interface Authority {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  latitude: number;
  longitude: number;
  jurisdictionRadiusKm: number;
  status: number;
  createdAt: string;
  userId: string | null;
  specializations: AuthoritySpecializationItem[];
  coverageAreas: AuthorityCoverageArea[];
}

export interface CreateAuthorityPayload {
  name: string;
  email?: string;
  phone?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  jurisdictionRadiusKm?: number;
}

export interface UpdateAuthorityPayload {
  name?: string;
  email?: string;
  phone?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  jurisdictionRadiusKm?: number;
  userId?: string;
  status?: number;
}

export interface Specialization {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName?: string | null;
}

export interface AuthoritiesListResponse {
  isSuccess: boolean;
  data: AuthorityProfile[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface LinkAuthorityUserPayload {
  userId: string;
  authorityId: string;
}

// ── SOS types (v2) ─────────────────────────────────────────────
export interface SOSLocationDto {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  recordedAtUtc: string;
  locationName: string | null;
}

export interface SOSBatchLocationItem {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitudeMeters?: number;
  recordedAtUtc: string; // ISO 8601 UTC
}

export interface SOSBatchLocationRequest {
  locations: SOSBatchLocationItem[]; // max 50
}

/** Member location entry inside SOSLiveStateDto */
export interface SOSMemberLocationDto {
  userId: string;
  userName: string;
  memberStatus: number;         // 0=Active, 1=LocationPending, 2=Inactive
  latitude: number;
  longitude: number;
  lastUpdatedAt: string;
  isStale: boolean;
  secondsSinceLastUpdate: number;
}

/** ⭐ v2 — Full live snapshot returned by GET /api/sosalerts/{id}/live-state
 *  NOTE: status/severity come as STRINGS from this endpoint.
 *  NOTE: initiatorLatitude/Longitude are direct fields (not nested in a location DTO).
 */
export interface SOSLiveStateDto {
  sosAlertId: string;
  communityId: string;
  status: string;                        // 'Active' | 'Resolved' | ...
  severity: string;                      // 'Standard' | 'High' | 'Critical'
  initiatorUserId: string;
  initiatorName: string;
  initiatorLatitude: number;             // 0 if no ping yet
  initiatorLongitude: number;            // 0 if no ping yet
  initiatorLastPingAt: string | null;
  isInitiatorLocationStale: boolean;
  memberLocations: SOSMemberLocationDto[];
  totalActiveMembers: number;
  totalLocationPendingMembers: number;
  totalStaleMembers: number;
  generatedAt: string;
}

export interface SOSAlert {
  id: string;
  status: SOSStatus;
  severity: SOSSeverity;
  message: string | null;
  initiatorUserId: string;
  communityId: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  resolvedAtUtc: string | null;
  recentLocations: SOSLocationDto[];
  totalLocationUpdates: number;
}

// ── SOS list types (v2 — paginated GET /api/sosalerts) ─────────────
/** Lightweight list item — no recentLocations[], use /{id}/live-state for full detail */
export interface SOSAlertListItem {
  id: string;
  status: SOSStatus;
  severity: SOSSeverity;
  message: string | null;
  initiatorUserId: string;
  communityId: string;
  /** Full list when SOS spans multiple communities */
  affectedCommunityIds?: string[];
  createdAtUtc: string;
  expiresAtUtc: string | null;
  resolvedAtUtc: string | null;
  isLocationStale: boolean;        // true if no ping for 60+ seconds
  lastLocationPingAt: string | null;
  totalLocationUpdates: number;
}

export interface SOSAlertListResponse {
  data: SOSAlertListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SOSAlertsListFilters {
  status?: string;       // 'Active' | 'Resolved' | 'Cancelled' | 'FalseAlarm' | 'Expired'
  severity?: string;     // 'Standard' | 'High' | 'Critical'
  communityId?: string;
  page?: number;
  pageSize?: number;
}

/** Reporter info returned by GET /api/sosalerts/{id} */
export interface SOSReporterDto {
  userId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  idCardPhotoUrl: string | null;
  nationalId: string | null;
  phoneNumber: string | null;
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  lastKnownLocationName: string | null;
}

/** Full detail returned by GET /api/sosalerts/{id} and embedded in ReceiveSOSTriggered */
export interface SOSAlertToReturnDto {
  id: string;
  /** Runtime: strings from GET list; integers from GET /{id} and SignalR — always normalize */
  status: SOSStatus | number;
  severity: SOSSeverity | number;
  message: string | null;
  initiatorUserId: string;
  communityId: string;
  /** Full list when SOS spans multiple communities */
  affectedCommunityIds?: string[];
  createdAtUtc: string;
  expiresAtUtc: string;
  resolvedAtUtc: string | null;
  recentLocations: SOSLocationDto[]; // most recent N locations (already seeded)
  totalLocationUpdates: number;      // always 0 from list; true count from live-state
  reporter: SOSReporterDto | null;
}

/** Per-card live state — owned by AuthoritySOS, updated via SignalR */
export interface ActiveSOSCardState {
  alertId: string;
  communityName: string;            // resolved from communityId
  locationHistory: SOSLocationDto[]; // seeded from recentLocations + GET /{id}/locations
  latestLocation: SOSLocationDto | null;
  totalPingsReceived: number;       // client-side counter (starts at 0, +1 per SignalR ping)
  lastPingAt: string | null;        // ISO timestamp of last received ping
  isLocationStale: boolean;         // true if lastPingAgeSeconds > 90
  lastPingAgeSeconds: number;       // live counter updated every second
  userHasPanned: boolean;           // suppresses auto-pan when true
  currentSeverity: SOSSeverity;     // kept in sync with ReceiveSeverityChanged
}

// ── Community types (v2) ────────────────────────────────────────
export interface LocationDto {
  latitude: number;
  longitude: number;
  city?: string;
  town?: string;
  street?: string;
}

export interface UserDetailsDto {
  usrId: string;
  userName: string;
  role: string;
  userLocation: LocationDto | null;
  lastLocationUpdatedAt: string | null;
}

/** GET /api/CommunityMember/members?communityId={id} */
export interface CommunityMemberDto {
  userId: string;
  userName: string;
  role: string;
  memberStatus?: MemberStatus;
  /** Legacy field name from older API responses */
  usrId?: string;
  userLocation: LocationDto | null;
  lastLocationUpdatedAt: string | null;
}

export interface CreateCommunityRequest {
  name: string;
  description?: string;
  communityType: CommunityType; // 0=Neighborhood, 1=Building, 2=PrivateGroup
  coverageRadiusMeters?: number;
}

/** ⭐ v2 — POST /api/Community now returns inviteCode */
export interface CreateCommunityResponse {
  id: string;
  name: string;
  description: string | null;
  communityType: CommunityType;
  coverageRadiusMeters: number | null;
  createdById: string;
  userName: string;
  createdAt: string;
  inviteCode: string | null;
  inviteCodeExpiresAt: string | null;
  userDetails: UserDetailsDto;
}

/** ⭐ v2 — POST /api/Community/join */
export interface JoinCommunityRequest {
  inviteCode: string; // 6-char alphanumeric
}

export interface JoinCommunityResponse {
  communityId: string;
  communityName: string;
  memberStatus: MemberStatus; // "Active" | "LocationPending"
  message: string;
  requiresLocation: boolean; // true when memberStatus = LocationPending
}

/** ⭐ v2 — POST /api/Community/{id}/regenerate-code */
export interface RegenerateCodeResponse {
  communityId: string;
  /** API response field */
  newInviteCode: string;
  /** Normalized alias for UI */
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
}

/** ⭐ v2 — GET /api/Community/nearby */
export interface NearbyCommunityDto {
  id: string;
  name: string;
  communityType: CommunityType;
  coverageRadiusMeters: number | null;
  distanceMeters: number;
  memberCount: number;
}

/** ⭐ v2 — GET /api/Community/all (enriched) */
export interface CommunitySystemListDto {
  id: string;
  name: string;
  description: string | null;
  communityType: CommunityType; // ⭐ NEW
  memberCount: number;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  lastModifiedAt: string | null;
  centroidLatitude: number | null;
  centroidLongitude: number | null;
  isWithinCallerJurisdiction: boolean;
  inviteCode: string | null;
  inviteCodeExpiresAt?: string | null;
  inviteCodeUsedCount?: number;
  inviteCodeMaxUses?: number;
  /** Caller's role in this community (when applicable) */
  myRole?: string | null;
  isArchived?: boolean;
  pendingJoinRequestCount?: number;
}

export type {
  JoinStatus,
  CommunityRoleName,
  CommunityTypeName,
  CommunitySearchResultDto,
  CommunityJoinResultDto,
  JoinRequestDto,
  MemberDetailDto,
  BulkRegenerateInviteCodesResponse,
  CommunityDetailDto,
  CitizenCommunityDto,
} from './community';