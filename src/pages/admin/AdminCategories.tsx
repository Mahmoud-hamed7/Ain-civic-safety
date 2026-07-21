import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ChevronRight, Tag } from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotificationStore } from '../../store/notificationStore';

interface Category   { id: string; name: string; description?: string; iconName?: string; authorityId?: string }
interface Specialization { id: string; name: string; description?: string; iconName?: string; categoryId: string }

function SpecModal({
  open, spec, categoryId, onClose, onSave,
}: {
  open: boolean; spec: Specialization | null; categoryId: string; onClose: () => void; onSave: (d: any) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(
    spec ? { name: spec.name, description: spec.description ?? '', iconName: spec.iconName ?? '' }
         : { name: '', description: '', iconName: '' }
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-start">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-white mb-4">{spec ? t('admin_categories.edit', 'Edit Specialization') : t('admin_categories.add', 'Add Specialization')}</h3>
        {(['name', 'iconName', 'description'] as const).map((f) => (
          <div key={f} className="mb-3">
            <label className="block text-xs font-semibold text-gray-400 mb-1 capitalize">
              {f === 'iconName' ? t('admin_categories.icon_name', 'Icon Name') : t(`admin_categories.${f}`, f)}
              {f === 'name' ? ' *' : ''}
            </label>
            <input value={form[f]} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
              placeholder={f === 'iconName' ? 'e.g. shield, fire…' : ''}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 text-start" />
          </div>
        ))}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">{t('admin_categories.cancel', 'Cancel')}</button>
          <button disabled={!form.name.trim()} onClick={() => onSave({ ...form, categoryId })}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-40">
            {spec ? t('admin_categories.save', 'Save') : t('admin_categories.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [selected,    setSelected]    = useState<Category | null>(null);
  const [catForm,     setCatForm]     = useState<{ open: boolean; cat: Category | null }>({ open: false, cat: null });
  const [catFormData, setCatFormData] = useState({ name: '', description: '', iconName: '' });
  const [deleteCat,   setDeleteCat]   = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [specModal,   setSpecModal]   = useState<{ open: boolean; spec: Specialization | null }>({ open: false, spec: null });
  const [deleteSpec,  setDeleteSpec]  = useState<{ open: boolean; id: string; name: string } | null>(null);

  const { data: categories, isLoading: loadingCats } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn:  () => apiClient.get('/api/categories').then((r) => r.data),
  });

  const { data: specs, isLoading: loadingSpecs } = useQuery<Specialization[]>({
    queryKey: ['specializations', 'by-category', selected?.id],
    queryFn:  () => apiClient.get(`/api/specializations/by-category?categoryId=${selected?.id}`).then((r) => r.data),
    enabled: !!selected?.id,
  });

  const mutateCat = (fn: () => Promise<any>, msg: string, afterKey: any[]) =>
    fn()
      .then(() => { addToast({ type: 'success', title: 'Done', description: msg }); afterKey.forEach((k) => qc.invalidateQueries({ queryKey: k })); setCatForm({ open: false, cat: null }); setDeleteCat(null); })
      .catch((e: any) => addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Failed.' }));

  const mutateSpec = (fn: () => Promise<any>, msg: string) =>
    fn()
      .then(() => { addToast({ type: 'success', title: 'Done', description: msg }); qc.invalidateQueries({ queryKey: ['specializations', 'by-category', selected?.id] }); setSpecModal({ open: false, spec: null }); setDeleteSpec(null); })
      .catch((e: any) => addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Failed.' }));

  const openCatForm = (cat: Category | null) => {
    setCatFormData(cat ? { name: cat.name, description: cat.description ?? '', iconName: cat.iconName ?? '' } : { name: '', description: '', iconName: '' });
    setCatForm({ open: true, cat });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-6 min-h-[calc(100vh-64px)] text-start">
      {/* ── Left: Category list ── */}
      <div className="w-full md:w-72 shrink-0 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">{t('admin_categories.title', 'Categories')}</h2>
          <button onClick={() => openCatForm(null)}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {t('admin_categories.new', 'New')}
          </button>
        </div>

        {loadingCats ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} type="table-row" className="h-10" />)}</div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
            {(categories ?? []).map((cat) => (
              <li key={cat.id}>
                <button
                  onClick={() => setSelected(cat)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-start text-sm transition-colors ${selected?.id === cat.id ? 'bg-indigo-600/15 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="font-medium truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openCatForm(cat); }} className="p-1 text-gray-600 hover:text-indigo-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteCat({ open: true, id: cat.id, name: cat.name }); }} className="p-1 text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    <ChevronRight className={`w-3.5 h-3.5 text-gray-600 transition-transform ${selected?.id === cat.id ? 'rotate-90 text-indigo-400' : ''} ${isRtl && selected?.id !== cat.id ? 'rotate-180' : isRtl && selected?.id === cat.id ? '-rotate-90' : selected?.id === cat.id ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              </li>
            ))}
            {!loadingCats && categories?.length === 0 && (
              <p className="text-center py-8 text-gray-500 text-xs">{t('admin_categories.no_categories', 'No categories yet.')}</p>
            )}
          </ul>
        )}
      </div>

      {/* ── Right: Category detail + specializations ── */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Tag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{t('admin_categories.select_category', 'Select a category to view details')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div className="text-start">
                  <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                  {selected.description && <p className="text-sm text-gray-400 mt-0.5">{selected.description}</p>}
                  {selected.iconName && <p className="text-xs text-gray-600 mt-1">Icon: {selected.iconName}</p>}
                </div>
                <button onClick={() => openCatForm(selected)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-400/10 border border-indigo-400/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> {t('admin_categories.edit', 'Edit')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{t('admin_categories.specializations', 'Specializations')}</h3>
                <button onClick={() => setSpecModal({ open: true, spec: null })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> {t('admin_categories.add', 'Add')}
                </button>
              </div>

              {loadingSpecs ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} type="table-row" className="h-12" />)}</div>
              ) : (
                <div className="space-y-2">
                  {(specs ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-gray-800/60 border border-gray-700/50 rounded-xl">
                      <div className="text-start min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{s.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ms-4">
                        <button onClick={() => setSpecModal({ open: true, spec: s })} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteSpec({ open: true, id: s.id, name: s.name })} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {specs?.length === 0 && (
                    <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-800 rounded-xl">
                      <p className="text-xs text-gray-600">No specializations yet — click Add to create one.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {catForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-start">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCatForm({ open: false, cat: null })} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-white mb-4">{catForm.cat ? t('admin_categories.edit', 'Edit Category') : t('admin_categories.new', 'New Category')}</h3>
            {(['name', 'iconName', 'description'] as const).map((f) => (
              <div key={f} className="mb-3">
                <label className="block text-xs font-semibold text-gray-400 mb-1 capitalize">
                  {f === 'iconName' ? t('admin_categories.icon_name', 'Icon Name') : t(`admin_categories.${f}`, f)}
                  {f === 'name' ? ' *' : ''}
                </label>
                <input value={catFormData[f]} onChange={(e) => setCatFormData((s) => ({ ...s, [f]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 text-start" />
              </div>
            ))}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setCatForm({ open: false, cat: null })} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">{t('admin_categories.cancel', 'Cancel')}</button>
              <button disabled={!catFormData.name.trim()}
                onClick={() => {
                  const fn = catForm.cat
                    ? () => apiClient.put(`/api/categories/${catForm.cat!.id}`, catFormData)
                    : () => apiClient.post('/api/categories', catFormData);
                  mutateCat(fn, catForm.cat ? 'Category updated.' : 'Category created.', [['categories']]);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-40">
                {catForm.cat ? t('admin_categories.save', 'Save') : t('admin_categories.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteCat?.open}
        title="Delete Category"
        message={<>Delete <strong className="text-white">{deleteCat?.name}</strong>? All linked specializations may be affected.</>}
        confirmText="Delete"
        onConfirm={() => deleteCat && mutateCat(() => apiClient.delete(`/api/categories/${deleteCat.id}`), 'Category deleted.', [['categories']])}
        onCancel={() => setDeleteCat(null)}
      />

      <SpecModal
        open={specModal.open}
        spec={specModal.spec}
        categoryId={selected?.id ?? ''}
        onClose={() => setSpecModal({ open: false, spec: null })}
        onSave={(d) => {
          const fn = specModal.spec
            ? () => apiClient.put(`/api/specializations/${specModal.spec!.id}`, d)
            : () => apiClient.post('/api/specializations', d);
          mutateSpec(fn, specModal.spec ? 'Specialization updated.' : 'Specialization added.');
        }}
      />

      <ConfirmDialog
        open={!!deleteSpec?.open}
        title="Delete Specialization"
        message={<>Delete <strong className="text-white">{deleteSpec?.name}</strong>?</>}
        confirmText="Delete"
        onConfirm={() => deleteSpec && mutateSpec(() => apiClient.delete(`/api/specializations/${deleteSpec.id}`), 'Specialization deleted.')}
        onCancel={() => setDeleteSpec(null)}
      />
    </div>
  );
}