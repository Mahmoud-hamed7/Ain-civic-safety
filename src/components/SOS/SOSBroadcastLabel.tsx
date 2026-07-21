import {
  collectAffectedCommunityIds,
  formatAffectedCommunitiesBroadcast,
  resolveAffectedCommunityNames,
} from '../../utils/sosCommunities';

export default function SOSBroadcastLabel({
  communityId,
  affectedCommunityIds,
  nameMap,
  className = 'text-xs text-indigo-300',
}: {
  communityId: string;
  affectedCommunityIds?: string[] | null;
  nameMap: Map<string, string>;
  className?: string;
}) {
  const ids = collectAffectedCommunityIds(communityId, affectedCommunityIds);
  const names = resolveAffectedCommunityNames(ids, nameMap);
  const broadcast = formatAffectedCommunitiesBroadcast(names);

  if (!broadcast) return null;

  return <p className={className}>{broadcast}</p>;
}
