import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Users } from 'lucide-react';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import Skeleton from '../Skeleton';
import { TILE_URL, createCustomIcon } from '../../utils/map';
import type { MemberDetailDto } from '../../types/community';

function MemberGpsCell({ member }: { member: MemberDetailDto }) {
  const hasGps = member.locationLatitude != null && member.locationLongitude != null;
  if (!hasGps) {
    return <span className="text-amber-500 text-xs">Location not shared</span>;
  }
  return (
    <span className="text-gray-400 text-xs flex items-center gap-1">
      <MapPin className="w-3 h-3 text-emerald-400" />
      {member.lastLocationUpdatedAt
        ? new Date(member.lastLocationUpdatedAt).toLocaleString()
        : 'Location on file'}
    </span>
  );
}

export default function CommunityMembersPanel({ communityId }: { communityId: string }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: communityKeys.members(communityId),
    queryFn: () => communityApi.getMembers(communityId),
    enabled: !!communityId,
  });

  const withGps = members.filter(
    (m) => m.locationLatitude != null && m.locationLongitude != null,
  );  const mapCenter: [number, number] =
    withGps.length > 0
      ? [withGps[0].locationLatitude!, withGps[0].locationLongitude!]
      : [30.0444, 31.2357];
  if (isLoading) {
    return <Skeleton type="card" className="h-40" />;
  }

  return (
    <div className="space-y-3 pt-2 border-t border-gray-800">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> Members ({members.length})
      </p>

      {withGps.length > 0 && (
        <div className="h-40 rounded-xl overflow-hidden border border-gray-700">
          <MapContainer
            center={mapCenter}
            zoom={13}
            className="h-full w-full"
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url={TILE_URL} />
            {members.map((member) => {
              if (member.locationLatitude == null || member.locationLongitude == null) return null;
              return (
                <Marker
                  key={member.userId}
                  position={[member.locationLatitude, member.locationLongitude]}
                  icon={createCustomIcon('#10b981', 14)}
                >
                  <Popup>{member.userName}</Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/60 text-gray-400">
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold">Role</th>
              <th className="px-3 py-2 text-left font-semibold">GPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {members.map((member) => (
              <tr key={member.userId}>
                <td className="px-3 py-2 text-white font-medium">{member.userName}</td>
                <td className="px-3 py-2 text-gray-400">{member.role}</td>
                <td className="px-3 py-2">
                  <MemberGpsCell member={member} />
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
