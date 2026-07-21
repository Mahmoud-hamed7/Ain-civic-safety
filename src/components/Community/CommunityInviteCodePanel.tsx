import { useState } from 'react';
import { Key, RefreshCw, Trash2, Copy, CheckCheck } from 'lucide-react';
import {
  resolveCommunityInviteCode,
  resolveCommunityInviteCodeExpiresAt,
} from '../../api/community';

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-sm font-mono font-bold text-indigo-300 hover:text-white transition-colors"
    >
      <span className="tracking-widest">{code}</span>
      {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function CommunityInviteCodePanel({
  communityId,
  inviteCode: apiCode,
  inviteCodeExpiresAt: apiExpires,
  onRegenerate,
  onRevoke,
  readOnly = false,
}: {
  communityId: string;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: string | null;
  onRegenerate?: () => void;
  onRevoke?: () => void;
  readOnly?: boolean;
}) {
  const inviteCode = resolveCommunityInviteCode(communityId, apiCode ?? null);
  const inviteCodeExpiresAt = resolveCommunityInviteCodeExpiresAt(communityId, apiExpires ?? null);

  return (
    <div className="pt-4 border-t border-gray-800 space-y-2">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <Key className="w-3.5 h-3.5" /> Invite Code
      </p>
      {inviteCode ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CopyCode code={inviteCode} />
          {inviteCodeExpiresAt && (
            <span className="text-[10px] text-gray-500">
              Expires {new Date(inviteCodeExpiresAt).toLocaleDateString()}
            </span>
          )}
          {!readOnly && onRegenerate && onRevoke && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onRegenerate}
                title="Generate new code"
                className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRevoke}
                title="Revoke invite code"
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <p className="text-xs text-gray-500">No active invite code</p>
      ) : (
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <Key className="w-3.5 h-3.5" /> Generate invite code
        </button>
      )}
    </div>
  );
}
