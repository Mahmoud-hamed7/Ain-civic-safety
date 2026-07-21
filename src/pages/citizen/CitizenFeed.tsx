import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale'; // 👈 لغات التاريخ
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { Search, Filter, Paperclip, MapPin, Clock } from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import type { Report } from '../../types';
import { getStatusPinColor } from '../../utils/map';

const STATUSES = ['All', 'UnderReview', 'Dispatched', 'ReSolved', 'Rejected'];

function ReportCard({ report }: { report: Report & { categoryName?: string } }) {
  const { t, i18n } = useTranslation();
  const color = getStatusPinColor(report.status);
  
  const dateLocale = i18n.language.startsWith('ar') ? ar : enUS;
  const timeAgo = (() => {
    try { 
      return formatDistanceToNow(new Date(report.createdAt), { 
        addSuffix: true, 
        locale: dateLocale 
      }); 
    }
    catch { return ''; }
  })();

  return (
    <Link to={`/citizen/report/${report.id}`} className="group block">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-full flex flex-col hover:border-gray-600 hover:bg-gray-900/80 transition-all duration-200 hover:shadow-xl hover:shadow-black/20">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 truncate">
            {(report as any).categoryName ?? (report as any).category ?? t('feed.general', 'General')}
          </span>
          <span
            className="shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            {t(`status.${report.status}`, report.status === 'ReSolved' ? 'Resolved' : report.status)}
          </span>
        </div>

        {/* Title + description */}
        <h3 className="text-base font-bold text-white mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {report.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-3 flex-1 leading-relaxed">{report.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span dir="auto">{timeAgo}</span>
          </span>
          <div className="flex items-center gap-3">
            {report.attachments?.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {report.attachments.length}
              </span>
            )}
            {(report as any).latitude && (
              <span className="flex items-center gap-1 text-indigo-500">
                <MapPin className="w-3 h-3" />
                {t('feed.located', 'Located')}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CitizenFeed() {
  const { t } = useTranslation();
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery<Report[]>({
    queryKey: ['reports', 'public', search, status],
    queryFn: () =>
      apiClient.get('/api/reports/public', {
        params: {
          search: search || undefined,
          status: status === 'All' ? undefined : status,
          pageSize: 30,
        },
      }).then((r) => r.data?.reports ?? r.data?.items ?? r.data ?? []),
  });

  const reports: Report[] = Array.isArray(data) ? data : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('feed.title', 'Public Feed')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('feed.subtitle', 'Community reports in your area')}</p>
        </div>
        <Link
          to="/citizen/report/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          {t('feed.submit_report', '+ Submit Report')}
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          {/* استخدمنا start-3 بدل left-3 */}
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('feed.search_placeholder', 'Search reports…')}
            /* استخدمنا ps-9 و pe-4 بدل pl و pr */
            className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters((f) => !f)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            showFilters ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          <Filter className="w-4 h-4" /> {t('feed.filters', 'Filters')}
        </button>
      </div>

      {/* Status filter tabs */}
      {showFilters && (
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {t(`status.${s}`, s === 'ReSolved' ? 'Resolved' : s)}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="card" className="h-52" />)}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState 
          title={t('feed.no_reports', 'No reports found')} 
          message={t('feed.no_reports_desc', 'No public reports match your search. Try adjusting your filters.')} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}