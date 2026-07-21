import { useQuery } from '@tanstack/react-query';
import { communityApi, resolveCommunityInviteCode, resolveCommunityInviteCodeExpiresAt } from '../api/community';
import { communityKeys } from '../queryKeys';
import type { CommunityType } from '../types';

/** List endpoints omit inviteCode — hydrate from GET /api/Community/{id} when needed. */
export function useCommunityInviteCode(
  communityId: string,
  options: {
    fromApi?: string | null;
    fromApiExpires?: string | null;
    communityType?: CommunityType | number;
    enabled?: boolean;
  } = {},
) {
  const { fromApi, fromApiExpires, communityType = 0, enabled = true } = options;
  const cached = resolveCommunityInviteCode(communityId, fromApi ?? null);
  // List DTOs often omit inviteCode and communityType — fetch detail when missing.
  const needsFetch = enabled && !!communityId && !cached;

  const { data, isLoading } = useQuery({
    queryKey: [...communityKeys.detail(communityId), 'invite-code'],
    queryFn: async () => {
      const detail = await communityApi.getById(communityId);
      return {
        inviteCode: detail.inviteCode ?? null,
        inviteCodeExpiresAt: detail.inviteCodeExpiresAt ?? null,
        communityType: detail.communityType,
      };
    },
    enabled: needsFetch,
    staleTime: 5 * 60_000,
  });

  return {
    inviteCode: resolveCommunityInviteCode(communityId, fromApi ?? data?.inviteCode ?? null),
    inviteCodeExpiresAt: resolveCommunityInviteCodeExpiresAt(
      communityId,
      fromApiExpires ?? data?.inviteCodeExpiresAt ?? null,
    ),
    resolvedType: data?.communityType ?? communityType,
    loadingInvite: needsFetch && isLoading,
  };
}
