import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Search, ChevronLeft, ChevronRight, MoreVertical,
  UserCheck, UserX, Shield, Link2, Flag, Unlink,
  CheckCircle, XCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import LinkAuthorityModal from '../../components/LinkAuthorityModal';
import { useNotificationStore } from '../../store/notificationStore';

const ROLES = ['All', 'Citizen', 'Authority', 'Admin'];
const LINKED = ['All', 'Linked', 'Unlinked'];

type ModalState =
  | { type: 'none' }
  | { type: 'deactivate';  userId: string; name: string }
  | { type: 'reactivate';  userId: string; name: string }
  | { type: 'role';        userId: string; name: string; currentRole: string }
  | { type: 'flag';        userId: string; name: string }
  | { type: 'unlink';      userId: string; name: string }
  | { type: 'link';        userId: string };

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    Admin: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    SuperAdmin: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Authority: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Citizen: 'bg-gray-500/20 text-gray-300 border-gray-600',
  };

  const translatedRole = t(`admin_users.roles_label.${role.toLowerCase()}`, role);

  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${colors[role] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
      {translatedRole}
    </span>
  );
}

function KebabMenu({ user, onAction }: { user: any; onAction: (modal: ModalState) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items = [
    { icon: user.isLocked ? UserCheck : UserX, label: user.isLocked ? t('admin_users.reactivate', 'Reactivate') : t('admin_users.deactivate', 'Deactivate'),
      action: () => onAction(user.isLocked
        ? { type: 'reactivate', userId: user.id, name: user.displayName ?? user.userName }
        : { type: 'deactivate', userId: user.id, name: user.displayName ?? user.userName }) },
    { icon: Shield, label: t('admin_users.change_role', 'Change Role'),
      action: () => onAction({ type: 'role', userId: user.id, name: user.displayName ?? user.userName, currentRole: user.roles?.[0] ?? 'Citizen' }) },
    { icon: Flag, label: t('admin_users.flag_user', 'Flag User'),
      action: () => onAction({ type: 'flag', userId: user.id, name: user.displayName ?? user.userName }) },
    ...(user.linkedAuthority
      ? [{ icon: Unlink, label: t('admin_users.unlink_auth', 'Unlink Authority'),
          action: () => onAction({ type: 'unlink', userId: user.id, name: user.displayName ?? user.userName }) }]
      : [{ icon: Link2, label: t('admin_users.link_auth', 'Link to Authority'),
          action: () => onAction({ type: 'link', userId: user.id }) }]),
  ];

  return (
    <div className="relative inline-block text-start" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute end-0 top-8 z-30 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {items.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={() => { action(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-start"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [search,       setSearch]       = useState('');
  const [role,         setRole]         = useState('All');
  const [linkedStatus, setLinkedStatus] = useState('All');
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState<ModalState>({ type: 'none' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { search, role, linkedStatus, page }],
    queryFn:  () =>
      apiClient.get('/api/admin/users', {
        params: {
          search:       search || undefined,
          role:         role === 'All' ? undefined : role,
          linkedStatus: linkedStatus === 'All' ? undefined : linkedStatus.toLowerCase(),
          page,
          pageSize:     20,
        },
      }).then((r) => r.data),
  });

  const users      = data?.users ?? data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const mutate = (fn: () => Promise<any>, successMsg: string) =>
    fn()
      .then(() => {
        addToast({ type: 'success', title: 'Done', description: successMsg });
        qc.invalidateQueries({ queryKey: ['admin', 'users'] });
        setModal({ type: 'none' });
      })
      .catch((e: any) =>
        addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Action failed' })
      );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-white text-start">{t('admin_users.title', 'User Management')}</h1>
        <div className="text-sm text-gray-400">{t('admin_users.users_count', '{{count}} users').replace('{{count}}', String(data?.totalCount ?? 0))}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin_users.search', 'Search by name, email, or phone…')}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors text-start"
          />
        </div>

        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => { setRole(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${role === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t(`admin_users.roles.${r.toLowerCase()}`, r)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {LINKED.map((l) => (
            <button
              key={l}
              onClick={() => { setLinkedStatus(l); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${linkedStatus === l ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t(`admin_users.linked_status.${l.toLowerCase()}`, l)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {[
                    t('admin_users.table_user', 'User'), 
                    t('admin_users.table_phone', 'Phone'), 
                    t('admin_users.table_roles', 'Roles'), 
                    t('admin_users.table_linked', 'Linked Authority'), 
                    t('admin_users.table_status', 'Status'), 
                    ''
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {(u.displayName ?? u.userName ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 text-start">
                          <p className="font-semibold text-white truncate">{u.displayName ?? u.userName}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-start" dir="ltr">{u.phoneNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-start">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r: string) => <RoleBadge key={r} role={r} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-start">
                      {u.linkedAuthority ? (
                        <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">
                          {u.linkedAuthority.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-start">
                      {u.isLocked ? (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> {t('admin_users.locked', 'Locked')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> {t('admin_users.active', 'Active')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <KebabMenu user={u} onAction={setModal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center py-12 text-gray-500 text-sm">{t('admin_users.no_users', 'No users found.')}</p>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 👇 المودالز اللي كانت ناقصة وضفتها كلها هنا 👇 */}
      <ConfirmDialog
        open={modal.type === 'deactivate'}
        title={t('admin_users.deactivate', 'Deactivate User')}
        message={<>Deactivate <strong className="text-white">{modal.type === 'deactivate' ? modal.name : ''}</strong>? They will be locked out immediately.</>}
        confirmText={t('admin_users.deactivate', 'Deactivate')}
        onConfirm={() => modal.type === 'deactivate' && mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/deactivate`), 'User deactivated.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      <ConfirmDialog
        open={modal.type === 'reactivate'}
        title={t('admin_users.reactivate', 'Reactivate User')}
        message={<>Reactivate <strong className="text-white">{modal.type === 'reactivate' ? modal.name : ''}</strong>? They will regain access.</>}
        confirmText={t('admin_users.reactivate', 'Reactivate')}
        onConfirm={() => modal.type === 'reactivate' && mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/reactivate`), 'User reactivated.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      <ConfirmDialog
        open={modal.type === 'unlink'}
        title={t('admin_users.unlink_auth', 'Unlink Authority')}
        message={<>Unlink authority from <strong className="text-white">{modal.type === 'unlink' ? modal.name : ''}</strong>?</>}
        confirmText={t('admin_users.unlink_auth', 'Unlink')}
        onConfirm={() => modal.type === 'unlink' && mutate(() => apiClient.put(`/api/admin/users/${modal.userId}/unlink`), 'Authority unlinked.')}
        onCancel={() => setModal({ type: 'none' })}
      />

      {/* المودال المسؤول عن ربط المستخدم بالسلطة */}
      <LinkAuthorityModal
        open={modal.type === 'link'}
        onClose={() => setModal({ type: 'none' })}
      />
    </div>
  );
}