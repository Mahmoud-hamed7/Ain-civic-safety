import { forwardRef } from 'react';
import { Key, CheckCheck, AlertTriangle } from 'lucide-react';
import type { JoinCommunityResponse } from '../../../types';

const InviteCodeJoinPanel = forwardRef<
  HTMLInputElement,
  {
    inviteCode: string;
    onChange: (value: string) => void;
    onJoin: () => void;
    joining: boolean;
    joinResult: JoinCommunityResponse | null;
  }
>(function InviteCodeJoinPanel({ inviteCode, onChange, onJoin, joining, joinResult }, ref) {
  return (
    <div id="invite-code-panel" className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1.5">
        <Key className="w-3.5 h-3.5" /> Join via Invite Code
      </p>
      <p className="text-[10px] text-gray-600 mb-3">
        For Building and Private Group communities — enter the 6-character code from your invite.
      </p>
      <div className="flex gap-2">
        <input
          ref={ref}
          value={inviteCode}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
          placeholder="XXXXXX"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-gray-600 outline-none focus:border-indigo-500 tracking-widest uppercase"
        />
        <button
          type="button"
          onClick={onJoin}
          disabled={inviteCode.length < 6 || joining}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {joining ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
          ) : (
            'Join'
          )}
        </button>
      </div>
      {joinResult && (
        <div
          className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-medium ${
            joinResult.requiresLocation
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          }`}
        >
          {joinResult.requiresLocation ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCheck className="w-4 h-4 shrink-0" />
          )}
          <span>
            {joinResult.requiresLocation
              ? `Joined "${joinResult.communityName}" — share your location to activate SOS.`
              : `Welcome to "${joinResult.communityName}"!`}
          </span>
        </div>
      )}
    </div>
  );
});

export default InviteCodeJoinPanel;
