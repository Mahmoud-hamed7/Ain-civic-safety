import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale'; // 👈 لغات التاريخ
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  Plus, Eye, Clock, Paperclip, MapPin,
  FileText, CheckCircle, AlertCircle, XCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import type { Report } from '../../types';
import { getStatusPinColor } from '../../utils/map';

const STATUS_ICONS: Record<string, React.ReactElement> = {
  UnderReview: <Clock className="w-3.5 h-3.5" />,
  Dispatched:  <AlertCircle className="w-3.5 h-3.5" />,
  ReSolved:    <CheckCircle className="w-3.5 h-3.5" />,
  Rejected:    <XCircle className="w-3.5 h-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const color = getStatusPinColor(status);
  const icon  = STATUS_ICONS[status];
  
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full text-white"
      style={{ backgroundColor: color }}
    >
      {icon}
      {t(`status.${status}`, status === 'ReSolved' ? 'Resolved' : status)}
    </span>
  );
}

function VisibilityBadge({ v }: { v: string }) {
  const styles: Record<string, string> = {
    Public:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Confidential: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Anonymous:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[v] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
      {v}
    </span>
  );
}

export default function MyReports() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const dateLocale = isRtl ? ar : enUS;

  const { data, isLoading } = useQuery<Report[]>({
    queryKey: ['reports', 'my-reports'],
    queryFn: () => apiClient.get('/api/reports/my-reports').then((r) => r.data ?? []),
  });

  const reports: Report[] = Array.isArray(data) ? data : [];

  /* Summary stats */
  const stats = {
    total:      reports.length,
    resolved:   reports.filter((r) => r.status === 'ReSolved').length,
    pending:    reports.filter((r) => ['UnderReview', 'Dispatched'].includes(r.status)).length,
    rejected:   reports.filter((r) => r.status === 'Rejected').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('my_reports.title', 'My Reports')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('my_reports.subtitle', 'Track and manage your submitted reports')}</p>
        </div>
        <Link
          to="/citizen/report/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('my_reports.new_report', '+ New Report')}
        </Link>
      </div>

      {/* Summary KPI row */}
      {!isLoading && reports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('my_reports.stats_total', 'Total'),    value: stats.total,    color: '#6366f1', icon: <FileText className="w-4 h-4" />    },
            { label: t('my_reports.stats_resolved', 'Resolved'), value: stats.resolved, color: '#10b981', icon: <CheckCircle className="w-4 h-4" /> },
            { label: t('my_reports.stats_pending', 'Pending'),  value: stats.pending,  color: '#f59e0b', icon: <Clock className="w-4 h-4" />       },
            { label: t('my_reports.stats_rejected', 'Rejected'), value: stats.rejected, color: '#ef4444', icon: <XCircle className="w-4 h-4" />    },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18`, color }}>
                {icon}
              </div>
              <div>
                <p className="text-xl font-black tabular-nums text-white">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} type="table-row" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title={t('my_reports.no_reports_title', 'No reports yet')}
              message={t('my_reports.no_reports_desc', "You haven't submitted any reports. Help your community by reporting issues.")}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start"> {/* 👈 text-start بدل text-left */}
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {[
                    t('my_reports.col_title', 'Title'), 
                    t('my_reports.col_category', 'Category'), 
                    t('my_reports.col_status', 'Status'), 
                    t('my_reports.col_visibility', 'Visibility'), 
                    t('my_reports.col_attachments', 'Attachments'), 
                    t('my_reports.col_submitted', 'Submitted'), 
                    ''
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {reports.map((r) => {
                  const timeAgo = (() => {
                    try { return formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: dateLocale }); }
                    catch { return '—'; }
                  })();
                  return (
                    <tr key={r.id} className="hover:bg-gray-800/30 transition-colors group">
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                          {r.title}
                        </p>
                        {(r as any).latitude && (
                          <span className="text-[10px] text-indigo-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {t('my_reports.located', 'Located')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                          {(r as any).categoryName ?? (r as any).category ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3"><VisibilityBadge v={r.visibility} /></td>
                      <td className="px-4 py-3">
                        {r.attachments?.length > 0 ? (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Paperclip className="w-3 h-3" />{r.attachments.length}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap"><span dir="auto">{timeAgo}</span></td>
                      <td className="px-4 py-3 text-end"> {/* 👈 text-end عشان اللينك يبقى في الآخر */}
                        <Link
                          to={`/citizen/report/${r.id}`}
                          className="flex items-center justify-end gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> {t('my_reports.view', 'View')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}