/**
 * useCommunityNameMap — Fetches GET /api/Community/all and returns a stable
 * Map<communityId, communityName> for resolving raw UUIDs to human names.
 *
 * Access: [Authorize(Roles = "Admin,SuperAdmin,Authority")]
 * Backend auto-scopes the response: Authorities only receive communities
 * within their assigned jurisdiction.
 *
 * NOTE: The endpoint returns a paginated object, not a plain array.
 * Response shape: { communities: [...] | items: [...], totalPages, totalCount }
 * We request pageSize=1000 to fetch all communities in one call.
 *
 * Usage:
 *   const nameMap = useCommunityNameMap();
 *   const name = nameMap.get(communityId) ?? 'Unknown Community';
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import apiClient from '../api/client';
import type { CommunitySystemListDto } from '../types';

/** Normalize paginated GET /api/Community/all response to a community array. */
export function parseCommunityListFromResponse(data: unknown): CommunitySystemListDto[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.communities)) return obj.communities as CommunitySystemListDto[];
    if (Array.isArray(obj.items)) return obj.items as CommunitySystemListDto[];
    if (Array.isArray(obj.data)) return obj.data as CommunitySystemListDto[];
  }
  return [];
}

export function useCommunityNameMap(): Map<string, string> {
  const { data } = useQuery<any>({
    queryKey: ['community', 'all', 'name-map'],
    queryFn: () =>
      apiClient
        .get('/api/Community/all', { params: { pageNumber: 1, pageSize: 1000 } })
        .then((r) => r.data),
    staleTime: 5 * 60_000, // community names rarely change — cache for 5 min
    refetchOnWindowFocus: false,
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    // Response is paginated: { communities: [...] } or { items: [...] } or plain array
    const list = parseCommunityListFromResponse(data);
    for (const c of list) {
      map.set(c.id, c.name);
    }
    return map;
  }, [data]);
}

/** Resolve community name with console.warn on lookup failure (once per id). */
const warnedCommunityIds = new Set<string>();

export function resolveCommunityName(
  map: Map<string, string>,
  communityId: string,
): string {
  const name = map.get(communityId);
  if (name) return name;
  if (!warnedCommunityIds.has(communityId)) {
    warnedCommunityIds.add(communityId);
    console.warn(
      `[SOS Monitor] Unknown Community for id ${communityId} — ` +
      'GET /api/Community/all may have failed or returned empty.',
    );
  }
  return 'Unknown Community';
}

