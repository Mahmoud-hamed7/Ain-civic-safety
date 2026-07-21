import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MoreVertical, Shield, UserMinus, Crown } from 'lucide-react';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import ConfirmDialog from '../ConfirmDialog';
import { useNotificationStore } from '../../store/notificationStore';
import type { CommunityRoleName, MemberDetailDto } from '../../types/community';

const ASSIGNABLE_ROLES: CommunityRoleName[] = ['Member', 'Moderator', 'Admin'];

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    Owner: 'text-amber-400 bg-amber-400/10',
    Admin: 'text-indigo-400 bg-indigo-400/10',
    Moderator: 'text-blue-400 bg-blue-400/10',
    Member: 'text-gray-400 bg-gray-400/10',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[role] ?? colors.Member}`}>
      {role}
    </span>
  );
}

function JoinStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Approved: 'text-emerald-400',
    Pending: 'text-amber-400',
    Rejected: 'text-red-400',
    Banned: 'text-red-500',
  };
  return <span className={`text-xs font-medium ${colors[status] ?? 'text-gray-400'}`}>{status}</span>;
}

export default function CommunityMembersTable({
  communityId,
  members,
  readOnly = false,
  canTransferOwnership = false,
}: {
  communityId: string;
  members: MemberDetailDto[];
  readOnly?: boolean;
  canTransferOwnership?: boolean;
}) {
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<MemberDetailDto | null>(null);
  const [newRole, setNewRole] = useState<'Member' | 'Moderator' | 'Admin'>('Member');
  const [kickTarget, setKickTarget] = useState<MemberDetailDto | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberDetailDto | null>(null);

  const invalidateMembers = () => {
    qc.invalidateQueries({ queryKey: communityKeys.members(communityId) });
    qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    qc.invalidateQueries({ queryKey: communityKeys.myList() });
  };

  const onError = (error: unknown) => {
    addToast({ type: 'error', title: 'Error', description: extractCommunityApiError(error) });
  };

  const { mutate: changeRole, isPending: changingRole } = useMutation({
    mutationFn: () =>
      communityApi.changeMemberRole(communityId, roleModal!.userId, newRole),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Role updated' });
      setRoleModal(null);
      invalidateMembers();
    },
    onError,
  });

  const { mutate: kick, isPending: kicking } = useMutation({
    mutationFn: () => communityApi.kickMember(communityId, kickTarget!.userId),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Member removed' });
      setKickTarget(null);
      invalidateMembers();
    },
    onError,
  });

  const { mutate: transfer, isPending: transferring } = useMutation({
    mutationFn: () =>
      communityApi.transferOwnership(communityId, transferTarget!.userId),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Ownership transferred' });
      setTransferTarget(null);
      qc.invalidateQueries({ queryKey: communityKeys.members(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
    },
    onError,
  });

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-800">
              {['Name', 'Role', 'Join Status', 'Joined', ...(readOnly ? [] : ['Actions'])].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {members.map((m) => (
              <tr key={m.userId} className="hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{m.userName}</p>
                  {m.email && <p className="text-[10px] text-gray-500">{m.email}</p>}
                </td>
                <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                <td className="px-4 py-3"><JoinStatusBadge status={m.joinStatus} /></td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {m.joinedAt ? format(new Date(m.joinedAt), 'MMM d, yyyy') : '—'}
                </td>
                {!readOnly && (
                  <td className="px-4 py-3 relative">
                    {m.role !== 'Owner' && (
                      <>
                        <button
                          onClick={() => setMenuUserId(menuUserId === m.userId ? null : m.userId)}
                          className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuUserId === m.userId && (
                          <div className="absolute right-4 top-10 z-20 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1">
                            <button
                              onClick={() => {
                                setRoleModal(m);
                                setNewRole(m.role === 'Owner' ? 'Member' : (m.role as typeof newRole));
                                setMenuUserId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                            >
                              <Shield className="w-3.5 h-3.5" /> Change Role
                            </button>
                            <button
                              onClick={() => { setKickTarget(m); setMenuUserId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-gray-800"
                            >
                              <UserMinus className="w-3.5 h-3.5" /> Kick Member
                            </button>
                            {canTransferOwnership && (
                              <button
                                onClick={() => { setTransferTarget(m); setMenuUserId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-gray-800"
                              >
                                <Crown className="w-3.5 h-3.5" /> Transfer Ownership
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="px-4 py-10 text-center text-gray-500 text-sm">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRoleModal(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-white mb-4">Change Role — {roleModal.userName}</h3>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as typeof newRole)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white mb-4"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRoleModal(null)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
              <button
                disabled={changingRole}
                onClick={() => changeRole()}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!kickTarget}
        title="Kick Member"
        message={<>Remove <strong className="text-white">{kickTarget?.userName}</strong> from this community?</>}
        confirmText="Kick"
        onConfirm={() => kick()}
        onCancel={() => setKickTarget(null)}
        isLoading={kicking}
      />

      <ConfirmDialog
        open={!!transferTarget}
        title="Transfer Ownership"
        message={<>Transfer ownership to <strong className="text-white">{transferTarget?.userName}</strong>? You will lose owner privileges.</>}
        confirmText="Transfer"
        onConfirm={() => transfer()}
        onCancel={() => setTransferTarget(null)}
        isLoading={transferring}
      />
    </>
  );
}
