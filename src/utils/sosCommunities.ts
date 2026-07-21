/** Format multi-community SOS broadcast label for detail panels. */
export function formatAffectedCommunitiesBroadcast(
  names: string[],
  maxVisible = 2,
): string | null {
  const unique = names.filter(Boolean);
  if (unique.length <= 1) return null;

  const visible = unique.slice(0, maxVisible);
  const remaining = unique.length - visible.length;
  const suffix = remaining > 0 ? ` (+${remaining} more)` : '';
  return `Broadcast to: ${visible.join(', ')}${suffix}`;
}

export function collectAffectedCommunityIds(
  communityId: string,
  affectedCommunityIds?: string[] | null,
): string[] {
  const ids = affectedCommunityIds?.length
    ? [...affectedCommunityIds]
    : communityId
      ? [communityId]
      : [];
  return [...new Set(ids.filter(Boolean))];
}

export function resolveAffectedCommunityNames(
  ids: string[],
  nameMap: Map<string, string>,
): string[] {
  return ids.map((id) => nameMap.get(id) ?? `Community …${id.slice(-8)}`);
}
