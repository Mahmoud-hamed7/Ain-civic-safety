import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Search, ChevronLeft, ChevronRight, X, Eye,
  Trash2, Flag, ShieldAlert, ExternalLink, AlertTriangle, Paperclip, Building2,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getStatusPinColor } from '../../utils/map';
import { useNotificationStore } from '../../store/notificationStore';
import { getMediaUrl } from '../../utils/media';
import MediaImage from '../../components/MediaImage';
import {
  normalizeReportDetail,
  parseReportFeedResponse,
  type NormalizedReportListItem,
} from '../../utils/reports';
import type { Report } from '../../types';

const STATUSES   = ['All', 'UnderReview', 'Dispatched', 'ReSolved', 'Rejected'];
const VISIBILITY = ['All', 'Public', 'Confidential', 'Anonymous'];

// [باقي الـ Helper Functions زي StatusBadge و VisibilityBadge زي ما هي]
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full text-white" style={{ backgroundColor: getStatusPinColor(status) }}>
      {t(`status.${status}`, status === 'ReSolved' ? 'Resolved' : status)}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    Public:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Confidential: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Anonymous:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${colors[visibility] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
      {t(`visibility.${visibility.toLowerCase()}`, visibility)}
    </span>
  );
}

function authorityCellLabel(status: string, authorityName: string | null): string {
  if (authorityName) return authorityName;
  if (status === 'UnderReview') return 'Unassigned';
  return '—';
}

function isImageAttachment(contentType: string | null, fileName: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(fileName);
}

function ReportDetailSlideOver({ reportId, listItem, onClose }: { reportId: string; listItem: NormalizedReportListItem | null; onClose: () => void; }) {
  const { t } = useTranslation();
  const { data: rawDetail, isLoading, isError } = useQuery({
    queryKey: ['reports', reportId, 'admin-detail'],
    queryFn:  () => apiClient.get(`/api/reports/${reportId}`).then((r) => r.data),
    enabled:  !!reportId,
  });

  const detail: Report | null = rawDetail ? normalizeReportDetail(rawDetail) : null;
  const reporter = detail?.reporter ?? listItem?.reporter ?? null;
  const visibility = detail?.visibility ?? listItem?.visibility ?? 'Public';
  const categoryLabel = detail?.category ? [detail.category, detail.subCategory].filter(Boolean).join(' · ') : listItem?.categoryLabel;
  const attachments = detail?.attachments ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* 👈 استخدام border-s بدل border-l */}
      <div className="relative w-full max-w-xl bg-gray-900 border-s border-gray-700 h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-bold text-white">{t('admin_reports.report_detail', 'Report Detail')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {isLoading && !listItem ? (
          <div className="p-6 space-y-3"><Skeleton type="card" className="h-40" /><Skeleton type="card" className="h-40" /></div>
        ) : detail || listItem ? (
          <div className="p-6 space-y-6">
            {isError && listItem && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Full detail failed to load — showing list data until refresh.
              </div>
            )}

            <div>
              <div className="flex items-start gap-3 mb-3">
                <StatusBadge status={detail?.status ?? listItem?.status ?? 'Unknown'} />
                <VisibilityBadge visibility={visibility} />
              </div>
              <h3 className="text-lg font-bold text-white text-start">{detail?.title ?? listItem?.title}</h3>
              <p className="text-sm text-gray-400 mt-1 text-start">{detail?.description ?? listItem?.description}</p>
              <p className="text-xs text-gray-600 mt-2 text-start">
                {categoryLabel ?? 'Category unavailable'} ·{' '}
                {(detail?.createdAt ?? listItem?.createdAt) ? format(new Date(detail?.createdAt ?? listItem!.createdAt), 'MMM d, yyyy HH:mm') : ''}
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 text-start">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> {t('admin_reports.reporter_identity', 'Reporter Identity (Admin View)')}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm text-start">
                <div><p className="text-gray-500 text-xs">Name</p><p className="text-white font-medium">{reporter?.name ?? '—'}</p></div>
                <div><p className="text-gray-500 text-xs">National ID</p><p className="text-white font-mono">{reporter?.nationalId ?? '—'}</p></div>
                <div><p className="text-gray-500 text-xs">Email</p><p className="text-white truncate">{reporter?.email ?? '—'}</p></div>
                <div><p className="text-gray-500 text-xs">Phone</p><p className="text-white">{reporter?.phone ?? '—'}</p></div>
              </div>
              {reporter?.profilePhotoUrl && (
                <MediaImage
                  src={reporter.profilePhotoUrl}
                  alt={reporter.name ?? 'Reporter'}
                  className="w-14 h-14 rounded-full object-cover border border-gray-600"
                />
              )}
              {(reporter?.idCardUrl || reporter?.idCardBackUrl) && (
                <div className="grid grid-cols-2 gap-2">
                  {reporter.idCardUrl && (
                    <MediaImage src={reporter.idCardUrl} alt="ID front" className="w-full h-24 object-cover rounded-lg border border-gray-700" />
                  )}
                  {reporter.idCardBackUrl && (
                    <MediaImage src={reporter.idCardBackUrl} alt="ID back" className="w-full h-24 object-cover rounded-lg border border-gray-700" />
                  )}
                </div>
              )}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{t('admin_reports.attachments', 'Attachments')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {attachments.map((att) =>
                      isImageAttachment(att.contentType, att.fileName) ? (
                        <MediaImage
                          key={att.id || att.fileName}
                          src={att.filePath}
                          alt={att.fileName}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-700"
                        />
                      ) : (
                        <a
                          key={att.id || att.fileName}
                          href={getMediaUrl(att.filePath)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 p-2 rounded-lg border border-gray-700"
                        >
                          <Paperclip className="w-4 h-4 shrink-0" />
                          <span className="truncate">{att.fileName}</span>
                        </a>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <Link to={`/admin/reports/${reportId}`} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              <ExternalLink className="w-4 h-4" /> {t('admin_reports.open_full_page', 'Open full report page')}
            </Link>
          </div>
        ) : (
          <p className="p-6 text-gray-500 text-sm">Report not found.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('All');
  const [visibility, setVisibility] = useState('All');
  const [page,       setPage]       = useState(1);
  const [viewId,     setViewId]     = useState<string | null>(null);
  const [viewListItem, setViewListItem] = useState<NormalizedReportListItem | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; title: string } | null>(null);
  const [flagModal,   setFlagModal]   = useState<{ open: boolean; id: string } | null>(null);
  const [flagReason,  setFlagReason]  = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', { search, status, visibility, page }],
    queryFn: async () => {
      const res = await apiClient.get('/api/reports/authority-feed', {
        params: { status: status === 'All' ? undefined : status, page, pageSize: 20 },
      });
      const parsed = parseReportFeedResponse(res.data);
      let reports = parsed.reports;
      if (visibility !== 'All') reports = reports.filter((r) => r.visibility === visibility);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        reports = reports.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.reporter?.name?.toLowerCase().includes(q));
      }
      return {
        reports,
        callerAuthorityName: parsed.callerAuthorityName,
        totalCount: search.trim() || visibility !== 'All' ? reports.length : parsed.totalCount,
        totalPages: parsed.totalPages,
      };
    },
  });

  const reports    = data?.reports ?? [];
  const totalPages = data?.totalPages ?? 1;
  const displayCount = data?.totalCount ?? reports.length;

  const mutateAction = (fn: () => Promise<unknown>, msg: string, affectedId?: string) => {
    setActionLoading(true);
    fn()
      .then(() => {
        addToast({ type: 'success', title: 'Done', description: msg });
        qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
        qc.invalidateQueries({ queryKey: ['reports'] });
        if (affectedId && viewId === affectedId) closeDetail();
        setDeleteModal(null);
        setFlagModal(null);
        setFlagReason('');
      })
      .catch((e: { response?: { data?: { message?: string } } }) =>
        addToast({
          type: 'error',
          title: 'Error',
          description: e?.response?.data?.message ?? 'Action failed.',
        }),
      )
      .finally(() => setActionLoading(false));
  };

  const openDetail = (item: NormalizedReportListItem) => { setViewId(item.id); setViewListItem(item); };
  const closeDetail = () => { setViewId(null); setViewListItem(null); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="space-y-2 text-start">
          <h1 className="text-2xl font-bold text-white">{t('admin_reports.title', 'Report Management')}</h1>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-300 bg-purple-900/30 border border-purple-800/40 px-3 py-1 rounded-full">
            <Building2 className="w-4 h-4" />
            {data?.callerAuthorityName ?? t('admin_reports.all_stations', 'All Stations — System-wide View')}
          </span>
        </div>
        <p className="text-sm text-gray-400">{displayCount} reports</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          {/* 👈 تغيير left-3 إلى start-3 */}
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin_reports.search', 'Search reports…')}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${status === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t(`status.${s}`, s === 'ReSolved' ? 'Resolved' : s)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {VISIBILITY.map((v) => (
            <button key={v} onClick={() => { setVisibility(v); setPage(1); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${visibility === v ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t(`visibility.${v.toLowerCase()}`, v)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start"> {/* 👈 text-start */}
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {[
                    t('admin_reports.table_title', 'Title'), t('admin_reports.table_category', 'Category'), 
                    t('admin_reports.table_status', 'Status'), t('admin_reports.table_visibility', 'Visibility'), 
                    t('admin_reports.table_reporter', 'Reporter'), t('admin_reports.table_authority', 'Authority'), 
                    t('admin_reports.table_date', 'Date'), ''
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {reports.map((r) => {
                  const authorityLabel = authorityCellLabel(r.status, r.authorityName);
                  return (
                    <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 max-w-[180px]"><p className="text-white font-medium truncate">{r.title}</p></td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px]"><span className="line-clamp-2">{r.categoryLabel ?? '—'}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3"><VisibilityBadge visibility={r.visibility} /></td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{r.reporter?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{authorityLabel}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end"> {/* 👈 justify-end */}
                          <button type="button" onClick={() => openDetail(r)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setFlagModal({ open: true, id: r.id })} className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors" title="Flag"><Flag className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setDeleteModal({ open: true, id: r.id, title: r.title })} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {reports.length === 0 && <p className="text-center py-12 text-gray-500 text-sm">No reports found.</p>}
          </div>
        )}
      </div>

      {viewId && <ReportDetailSlideOver reportId={viewId} listItem={viewListItem} onClose={closeDetail} />}

      <ConfirmDialog
        open={!!deleteModal?.open}
        title={t('admin_reports.delete_title', 'Delete Report')}
        message={
          <>
            {t('admin_reports.delete_msg', 'Permanently delete')}{' '}
            <strong className="text-white">{deleteModal?.title}</strong>?
            {' '}
            {t('admin_reports.delete_warning', 'This cannot be undone.')}
          </>
        }
        confirmText={t('admin_reports.delete_confirm', 'Delete')}
        isLoading={actionLoading}
        onConfirm={() =>
          deleteModal &&
          mutateAction(
            () => apiClient.delete(`/api/admin/reports/${deleteModal.id}`),
            t('admin_reports.deleted', 'Report deleted.'),
            deleteModal.id,
          )
        }
        onCancel={() => setDeleteModal(null)}
      />

      {flagModal?.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setFlagModal(null); setFlagReason(''); }}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-white">
              {t('admin_reports.flag_title', 'Flag Report')}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {t('admin_reports.flag_desc', 'Provide a reason for moderation review.')}
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={4}
              placeholder={t('admin_reports.flag_reason', 'Reason…')}
              className="mt-4 w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setFlagModal(null); setFlagReason(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!flagReason.trim() || actionLoading}
                onClick={() =>
                  flagModal &&
                  mutateAction(
                    () => apiClient.post(`/api/admin/reports/${flagModal.id}/flag`, { reason: flagReason.trim() }),
                    t('admin_reports.flagged', 'Report flagged for review.'),
                    flagModal.id,
                  )
                }
                className="px-4 py-2 text-sm font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing…' : t('admin_reports.flag_confirm', 'Flag Report')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}