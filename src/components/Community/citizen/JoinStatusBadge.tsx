import type { JoinStatus } from '../../../types/community';

const STYLES: Record<JoinStatus, string> = {
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  Banned: 'bg-red-600/15 text-red-500 border-red-600/30',
};

export default function JoinStatusBadge({ status }: { status?: JoinStatus | null }) {
  if (!status || status === 'Approved') return null;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STYLES[status]}`}>
      {status}
    </span>
  );
}
