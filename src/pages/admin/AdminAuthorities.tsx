import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Plus, ChevronLeft, ChevronRight, Link2, Save, Trash2, X,
  Building2, CheckCircle2, Circle, Loader2,
} from 'lucide-react';
import { authoritiesApi } from '../../api/authorities';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotificationStore } from '../../store/notificationStore';
import type { AuthorityProfile, CreateAuthorityPayload, UpdateAuthorityPayload } from '../../types';

const PAGE_SIZE = 20;

function specId(spec: { id?: string; specializationId?: string }) { return spec.id ?? spec.specializationId ?? ''; }
interface DetailForm { name: string; type: string; email: string; phone: string; latitude: string; longitude: string; jurisdictionRadiusKm: string; }
function emptyForm(): DetailForm { return { name: '', type: '', email: '', phone: '', latitude: '', longitude: '', jurisdictionRadiusKm: '' }; }
function formFromAuthority(a: AuthorityProfile): DetailForm {
  return {
    name: a.name, type: a.type ?? '', email: a.email ?? '', phone: a.phone ?? '',
    latitude: a.latitude != null ? String(a.latitude) : '', longitude: a.longitude != null ? String(a.longitude) : '',
    jurisdictionRadiusKm: a.jurisdictionRadiusKm != null ? String(a.jurisdictionRadiusKm) : '',
  };
}

function CreateModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (authority: AuthorityProfile) => void;
}) {
  const { t } = useTranslation();
  const addToast = useNotificationStore((s) => s.addToast);
  const [form, setForm] = useState<DetailForm>(emptyForm());

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateAuthorityPayload) => authoritiesApi.create(payload),
    onSuccess: (created) => {
      addToast({ type: 'success', title: 'Created', description: 'Authority created.' });
      onCreated(created);
      setForm(emptyForm());
      onClose();
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Create failed.' }),
  });

  if (!open) return null;

  const set = (field: keyof DetailForm, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = () => {
    const payload: CreateAuthorityPayload = { name: form.name.trim() };
    if (form.type) payload.type = form.type;
    if (form.email) payload.email = form.email;
    if (form.phone) payload.phone = form.phone;
    if (form.latitude) payload.latitude = parseFloat(form.latitude);
    if (form.longitude) payload.longitude = parseFloat(form.longitude);
    if (form.jurisdictionRadiusKm) payload.jurisdictionRadiusKm = parseFloat(form.jurisdictionRadiusKm);
    mutate(payload);
  };

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors text-start';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-start">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white">{t('admin_auth.create_new', 'Create Authority')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Type</label>
              <input value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="Police, Fire…" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Radius (km)</label>
              <input type="number" value={form.jurisdictionRadiusKm} onChange={(e) => set('jurisdictionRadiusKm', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700">Cancel</button>
          <button
            disabled={!form.name.trim() || isPending}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-40"
          >
            {isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAuthorities() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuthorityProfile | null>(null);
  const [detailForm, setDetailForm] = useState<DetailForm>(emptyForm());
  const [userIdInput, setUserIdInput] = useState('');
  const [linkedSpecIds, setLinkedSpecIds] = useState<Set<string>>(new Set());
  const [togglingSpecId, setTogglingSpecId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const { data: listRes, isLoading: listLoading } = useQuery({ queryKey: ['authorities', page], queryFn: () => authoritiesApi.getAll(page, PAGE_SIZE) });
  const { data: allSpecs = [], isLoading: specsLoading } = useQuery({ queryKey: ['specializations'], queryFn: () => authoritiesApi.getAllSpecializations() });

  const authorities = listRes?.data ?? [];
  const totalCount = listRes?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (selected) { 
      setDetailForm(formFromAuthority(selected)); 
      setUserIdInput(selected.userId ?? ''); 
      setLinkedSpecIds(new Set(selected.specializations.map(specId))); 
    }
  }, [selected?.id]);

  const refreshList = () => qc.invalidateQueries({ queryKey: ['authorities'] });

  const selectAuthority = async (authority: AuthorityProfile) => {
    try { const full = await authoritiesApi.getById(authority.id); setSelected(full); }
    catch { setSelected(authority); }
  };

  const { mutate: updateDetails, isPending: updating } = useMutation({
    mutationFn: (payload: UpdateAuthorityPayload) =>
      authoritiesApi.update(selected!.id, payload),
    onSuccess: async () => {
      addToast({ type: 'success', title: 'Saved', description: 'Authority updated.' });
      refreshList();
      if (selected) {
        const refreshed = await authoritiesApi.getById(selected.id);
        setSelected(refreshed);
      }
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Update failed.' }),
  });

  // 👇 التعديل الأهم هنا لضمان إرسال الداتا الصحيحة للباك إند
  const { mutate: linkUser, isPending: linking } = useMutation({
    mutationFn: (data: { userId: string; authorityId: string }) =>
      authoritiesApi.linkUser(data),
    onSuccess: async () => {
      addToast({ type: 'success', title: 'Linked', description: 'User linked to authority.' });
      refreshList();
      if (selected) {
        const refreshed = await authoritiesApi.getById(selected.id);
        setSelected(refreshed);
      }
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Link failed.' }),
  });

  const { mutate: deactivate, isPending: deactivating } = useMutation({
    mutationFn: () => authoritiesApi.deactivate(selected!.id),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Deactivated', description: 'Authority deactivated.' });
      setSelected(null);
      setDeactivateOpen(false);
      refreshList();
    },
    onError: (e: any) =>
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Deactivate failed.' }),
  });

  const handleToggleSpec = async (specId: string) => {
    if (!selected) return;
    setTogglingSpecId(specId);
    try {
      if (linkedSpecIds.has(specId)) {
        await authoritiesApi.removeSpecialization(selected.id, specId);
        setLinkedSpecIds((prev) => {
          const next = new Set(prev);
          next.delete(specId);
          return next;
        });
      } else {
        await authoritiesApi.addSpecialization(selected.id, specId);
        setLinkedSpecIds((prev) => new Set(prev).add(specId));
      }
      refreshList();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Specialization update failed.' });
    } finally {
      setTogglingSpecId(null);
    }
  };

  const handleUpdate = () => {
    if (!selected) return;
    const payload: UpdateAuthorityPayload = {
      name: detailForm.name.trim(),
      type: detailForm.type || undefined,
      email: detailForm.email || undefined,
      phone: detailForm.phone || undefined,
    };
    if (detailForm.latitude) payload.latitude = parseFloat(detailForm.latitude);
    if (detailForm.longitude) payload.longitude = parseFloat(detailForm.longitude);
    if (detailForm.jurisdictionRadiusKm) payload.jurisdictionRadiusKm = parseFloat(detailForm.jurisdictionRadiusKm);
    updateDetails(payload);
  };

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors text-start';
  const setDetail = (field: keyof DetailForm, value: string) => setDetailForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 max-w-[1600px] mx-auto text-start">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin_auth.title', 'Authority Management')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('admin_auth.total_auth', '{{count}} authorities total').replace('{{count}}', String(totalCount))}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('admin_auth.create_new', 'Create New')}
        </button>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Left — Authorities list */}
        <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col min-h-[320px] lg:min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('admin_auth.auth_list', 'Authorities')}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
            ) : authorities.length === 0 ? (
              <p className="text-center py-10 text-gray-500 text-sm">No authorities found.</p>
            ) : (
              authorities.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectAuthority(a)}
                  className={`w-full text-start px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    selected?.id === a.id
                      ? 'bg-indigo-600/20 border-s-2 border-s-indigo-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${selected?.id === a.id ? 'text-indigo-400' : 'text-gray-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{a.type ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.userId && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Linked
                          </span>
                        )}
                        {a.status === 0 && (
                          <span className="text-[10px] text-red-400">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="px-3 py-2 border-t border-gray-800 flex items-center justify-between shrink-0">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500" dir="ltr">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center — Authority details */}
        <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col min-h-[320px] lg:min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('admin_auth.auth_details', 'Authority Details')}</p>
          </div>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-6 text-center">
              {t('admin_auth.select_prompt', 'Select an authority from the list to view and edit details.')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Name</label>
                <input value={detailForm.name} onChange={(e) => setDetail('name', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Type</label>
                  <input value={detailForm.type} onChange={(e) => setDetail('type', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Radius (km)</label>
                  <input type="number" value={detailForm.jurisdictionRadiusKm} onChange={(e) => setDetail('jurisdictionRadiusKm', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
                <input type="email" value={detailForm.email} onChange={(e) => setDetail('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Phone</label>
                <input value={detailForm.phone} onChange={(e) => setDetail('phone', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Latitude</label>
                  <input type="number" step="any" value={detailForm.latitude} onChange={(e) => setDetail('latitude', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Longitude</label>
                  <input type="number" step="any" value={detailForm.longitude} onChange={(e) => setDetail('longitude', e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Link User */}
              <div className="pt-2 border-t border-gray-800">
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> {t('admin_auth.link_user', 'Link User')}
                </label>
                <p className="text-[10px] text-gray-500 mb-2">
                  {t('admin_auth.link_user_desc', 'Paste the userId of an account with the Authority role. This links the login to this authority entity.')}
                </p>
                <div className="flex gap-2">
                  <input
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="e.g. 52298333-1b05-4077-84ae-741e3dc6c3a8"
                    className={`flex-1 ${inputCls} font-mono text-xs`}
                  />
                  {/* 👇 تم التعديل هنا để إرسال المتغيرات صح */}
                  <button
                    disabled={!userIdInput.trim() || linking}
                    onClick={() => linkUser({ userId: userIdInput.trim(), authorityId: selected!.id })}
                    className="px-3 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl disabled:opacity-40 shrink-0"
                  >
                    {linking ? '…' : 'Link'}
                  </button>
                </div>
                {selected.userId && (
                  <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {t('admin_auth.currently_linked', 'Currently linked:')} <span dir="ltr">{selected.userId}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  disabled={!detailForm.name.trim() || updating}
                  onClick={handleUpdate}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                  {updating ? 'Saving…' : t('admin_auth.update', 'Update')}
                </button>
                <button
                  onClick={() => setDeactivateOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" /> Deactivate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — Specializations */}
        <div className="lg:col-span-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col min-h-[320px] lg:min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('admin_auth.specializations', 'Specializations')}</p>
            {selected && (
              <p className="text-[10px] text-gray-500 mt-0.5">{linkedSpecIds.size} {t('admin_auth.linked', 'linked')}</p>
            )}
          </div>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-6 text-center">
              Select an authority to manage its specializations.
            </div>
          ) : specsLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {allSpecs.map((spec) => {
                const checked = linkedSpecIds.has(spec.id);
                const busy = togglingSpecId === spec.id;
                return (
                  <button
                    key={spec.id}
                    disabled={busy}
                    onClick={() => handleToggleSpec(spec.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start text-sm transition-colors ${
                      checked
                        ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                        : 'text-gray-300 hover:bg-gray-800 border border-transparent'
                    } disabled:opacity-60`}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin text-indigo-400" />
                    ) : checked ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0 text-gray-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{spec.name}</p>
                      {spec.categoryName && (
                        <p className="text-[10px] text-gray-500 truncate">{spec.categoryName}</p>
                      )}
                    </div>
                  </button>
                );
              })}
              {allSpecs.length === 0 && (
                <p className="text-center py-8 text-gray-500 text-sm">No specializations available.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          refreshList();
          selectAuthority(created);
        }}
      />

      <ConfirmDialog
        open={deactivateOpen}
        title="Deactivate Authority"
        message={<>Deactivate <strong className="text-white">{selected?.name}</strong>? This sets the authority to inactive.</>}
        confirmText="Deactivate"
        isLoading={deactivating}
        onConfirm={() => deactivate()}
        onCancel={() => setDeactivateOpen(false)}
      />
    </div>
  );
}