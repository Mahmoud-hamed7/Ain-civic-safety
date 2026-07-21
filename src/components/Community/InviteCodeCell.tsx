import { Key, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useCommunityInviteCode } from '../../hooks/useCommunityInviteCode';
import type { CommunityType } from '../../types';

export default function InviteCodeCell({
  communityId,
  inviteCode,
  inviteCodeExpiresAt,
  communityType = 0,
  onRegenerate,
  regenerating = false,
}: {
  communityId: string;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: string | null;
  communityType?: CommunityType | number;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const { inviteCode: code, inviteCodeExpiresAt: expires, loadingInvite } = useCommunityInviteCode(
    communityId,
    { fromApi: inviteCode, fromApiExpires: inviteCodeExpiresAt, communityType },
  );

  if (loadingInvite) {
    return <span className="text-xs text-gray-500">Loading code…</span>;
  }

  if (code) {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-300">
          <Key className="w-3 h-3" /> {code}
        </span>
        {expires && (
          <span className="text-[10px] text-gray-500">
            Expires {format(new Date(expires), 'MMM d, yyyy')}
          </span>
        )}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-400 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-amber-500">No active code</span>
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating ? 'Generating…' : 'Generate code'}
        </button>
      )}
    </div>
  );
}
