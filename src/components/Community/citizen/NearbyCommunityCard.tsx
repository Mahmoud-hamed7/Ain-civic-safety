import { Link } from 'react-router-dom';
import { MapPin, Users } from 'lucide-react';
import CommunityTypeBadge from '../CommunityTypeBadge';
import type { NearbyCommunityDto } from '../../../types';

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function NearbyCommunityCard({ community }: { community: NearbyCommunityDto }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
          {community.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-1.5">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{community.name}</h3>
            <CommunityTypeBadge type={community.communityType} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1 text-emerald-400">
              <MapPin className="w-3 h-3" /> {formatDistance(community.distanceMeters)} away
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {community.memberCount}
            </span>
          </div>
        </div>
      </div>
      <Link
        to={`/citizen/communities/discover?search=${encodeURIComponent(community.name)}`}
        className="flex items-center justify-center py-2 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 hover:bg-indigo-400/20 transition-colors"
      >
        View & Join
      </Link>
    </div>
  );
}
