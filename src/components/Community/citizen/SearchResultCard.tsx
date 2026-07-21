import { Users, UserPlus, Key, CheckCheck } from 'lucide-react';
import CommunityTypeBadge from '../CommunityTypeBadge';
import JoinStatusBadge from './JoinStatusBadge';
import { communityTypeFromSearch, joinStatusLabel } from '../../../utils/communityCitizen';
import type { CommunitySearchResultDto } from '../../../types/community';

export default function SearchResultCard({
  community,
  onJoinRequest,
  onFocusInviteCode,
  isRequesting,
}: {
  community: CommunitySearchResultDto;
  onJoinRequest: (id: string) => void;
  onFocusInviteCode: () => void;
  isRequesting: boolean;
}) {
  const typeNum = communityTypeFromSearch(community.communityType);

  function renderAction() {
    if (community.isAlreadyMember) {
      return (
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
          <CheckCheck className="w-3.5 h-3.5" /> Member ✓
        </div>
      );
    }
    switch (community.myJoinStatus) {
      case 'Pending':
        return <p className="text-center text-xs text-amber-400 py-2">Request Pending…</p>;
      case 'Rejected':
        return (
          <p className="text-center text-xs text-red-400 py-2" title={joinStatusLabel('Rejected')}>
            Request Rejected
          </p>
        );
      case 'Banned':
        return <p className="text-center text-xs text-red-500 py-2">Banned</p>;
      default:
        if (community.acceptsJoinRequests) {
          return (
            <button
              type="button"
              onClick={() => onJoinRequest(community.id)}
              disabled={isRequesting}
              className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 hover:bg-indigo-400/20 disabled:opacity-50 transition-colors w-full"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isRequesting ? 'Submitting…' : 'Request to Join'}
            </button>
          );
        }
        if (community.hasActiveInviteCode) {
          return (
            <button
              type="button"
              onClick={onFocusInviteCode}
              className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-purple-400 bg-purple-400/10 border border-purple-400/20 hover:bg-purple-400/20 transition-colors w-full"
            >
              <Key className="w-3.5 h-3.5" /> Enter Invite Code
            </button>
          );
        }
        return null;
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-700 text-gray-300 flex items-center justify-center font-bold text-sm shrink-0">
          {community.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-1.5">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{community.name}</h3>
            <CommunityTypeBadge type={typeNum} />
            <JoinStatusBadge status={community.myJoinStatus} />
          </div>
          {community.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {community.memberCount}
            </span>
            {community.coverageRadiusMeters != null && (
              <span>{(community.coverageRadiusMeters / 1000).toFixed(1)}km radius</span>
            )}
          </div>
        </div>
      </div>
      {renderAction()}
    </div>
  );
}
