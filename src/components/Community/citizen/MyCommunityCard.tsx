import { Link } from 'react-router-dom';

import {

  Users, UserMinus, MapPin, AlertTriangle, ChevronRight,

} from 'lucide-react';

import CommunityTypeBadge from '../CommunityTypeBadge';

import CommunityInviteCodePanel from '../CommunityInviteCodePanel';
import { useCommunityInviteCode } from '../../../hooks/useCommunityInviteCode';

import JoinStatusBadge from './JoinStatusBadge';

import { canManageCommunity } from '../../../utils/communityCitizen';

import type { CitizenCommunityDto } from '../../../types/community';

import type { CommunityType } from '../../../types';



export default function MyCommunityCard({

  community,

  userId,

  onLeave,

  onRegenerate,

  onRevoke,

}: {

  community: CitizenCommunityDto;

  userId: string;

  onLeave: (id: string, name: string) => void;

  onRegenerate: (id: string) => void;

  onRevoke: (id: string) => void;

}) {

  const isCreator = community.createdById === userId;

  const canManage = canManageCommunity(community.myRole, community.createdById, userId);
  const { inviteCode, inviteCodeExpiresAt } = useCommunityInviteCode(community.id, {
    fromApi: community.inviteCode,
    fromApiExpires: community.inviteCodeExpiresAt,
    communityType: community.communityType,
    enabled: canManage,
  });
  const showInvitePanel = canManage;

  const locationPending = community.userMemberStatus === 'LocationPending';

  const detailTab = canManage && (community.pendingJoinRequestCount ?? 0) > 0

    ? '?tab=join-requests'

    : '';



  return (

    <div

      className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 transition-colors ${

        locationPending ? 'border-amber-500/30' : 'border-gray-800 hover:border-gray-700'

      }`}

    >

      <div className="flex items-start gap-3">

        <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">

          {community.name.slice(0, 2).toUpperCase()}

        </div>

        <div className="flex-1 min-w-0">

          <div className="flex flex-wrap items-start gap-1.5">

            <Link

              to={`/citizen/communities/${community.id}${detailTab}`}

              className="font-bold text-white text-sm leading-tight hover:text-indigo-300 hover:underline"

            >

              {community.name}

            </Link>

            <CommunityTypeBadge type={community.communityType as CommunityType} />

            {community.myRole && (

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-400/10 text-indigo-300 border border-indigo-400/20">

                {community.myRole}

              </span>

            )}

            <JoinStatusBadge status={community.myJoinStatus} />

          </div>

          {community.description && (

            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{community.description}</p>

          )}

        </div>

      </div>



      {locationPending && (

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">

          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

          <div>

            <p className="text-xs font-semibold text-amber-300">Location Required</p>

            <p className="text-[10px] text-amber-400/70 mt-0.5">

              Share your location to activate SOS for this community.

            </p>

          </div>

        </div>

      )}



      <div className="flex items-center gap-4 text-xs text-gray-500">

        <span className="flex items-center gap-1">

          <Users className="w-3.5 h-3.5 text-indigo-400" />

          {community.memberCount} members

        </span>

        {community.centroidLatitude != null && (

          <span className="flex items-center gap-1">

            <MapPin className="w-3 h-3" /> Located

          </span>

        )}

        {isCreator && <span className="text-indigo-400 font-semibold">Creator</span>}

      </div>



      {showInvitePanel && (

        <CommunityInviteCodePanel

          communityId={community.id}

          inviteCode={inviteCode}

          inviteCodeExpiresAt={inviteCodeExpiresAt}

          onRegenerate={() => onRegenerate(community.id)}

          onRevoke={() => onRevoke(community.id)}

        />

      )}



      <Link

        to={`/citizen/communities/${community.id}${detailTab}`}

        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 hover:bg-indigo-400/20 transition-colors"

      >

        {canManage ? 'Manage Community' : 'View Members'}

        <ChevronRight className="w-3.5 h-3.5" />

      </Link>



      <button

        type="button"

        onClick={() => onLeave(community.id, community.name)}

        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"

      >

        <UserMinus className="w-3.5 h-3.5" /> Leave Community

      </button>

    </div>

  );

}


