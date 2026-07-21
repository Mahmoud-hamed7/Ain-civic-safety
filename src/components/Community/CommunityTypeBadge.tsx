import type { CommunityType } from '../../types';
import { communityTypeLabel } from '../../utils/communities';

const COLORS: Record<CommunityType, string> = {
  0: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  1: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  2: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

export default function CommunityTypeBadge({ type }: { type?: CommunityType }) {
  const t = type ?? 0;
  return (
    <span
      className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${COLORS[t]}`}
    >
      {communityTypeLabel(t)}
    </span>
  );
}
