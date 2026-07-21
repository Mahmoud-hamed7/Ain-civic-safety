import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Clock, FileText, TrendingUp, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import StatCard from '../../components/Charts/StatCard';
import DailyTrendChart from '../../components/Charts/DailyTrendChart';
import { getStatusPinColor } from '../../utils/map';

export default function AuthorityDashboard() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  const STATUS_LABELS: Record<string, string> = {
    UnderReview: t('status.UnderReview', 'Under Review'),
    Dispatched:  t('status.Dispatched', 'Dispatched'),
    ReSolved:    t('status.Resolved', 'Resolved'),
    Resolved:    t('status.Resolved', 'Resolved'),
    Rejected:    t('status.Rejected', 'Rejected'),
  };

  // الاعتماد بالكامل على الـ Feed API لعمل الإحصائيات والشارت والجدول
  const { data: feedData, isLoading: loadingCases } = useQuery({
    queryKey: ['reports', 'authority-feed', 'dashboard-stats'],
    queryFn: async () => {
      // كبرنا الـ pageSize لـ 100 عشان نجيب داتا كافية للحسابات والشارت
      const res = await apiClient.get('/api/reports/authority-feed', { params: { pageSize: 100 } });
      return res.data; 
    },
  });

  if (loadingCases) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} type="card" className="h-32" />)}
        </div>
        <Skeleton type="chart" />
      </div>
    );
  }

  const allReports = feedData?.reports || [];
  // عشان الجدول تحت ميبقاش طويل جداً، هناخد أحدث 10 بس للعرض
  const recentCasesForTable = allReports.slice(0, 10);

  // ─── 📊 حساب الإحصائيات ديناميكياً من الـ Feed ───
  const totalAssigned = feedData?.totalCount || 0;

  const totalResolved = allReports.filter((r: any) => r.status === 'Resolved' || r.status === 'ReSolved').length;
  
  const totalPending = allReports.filter((r: any) => r.status === 'UnderReview' || r.status === 'Dispatched').length;

  const overdueCases = allReports.filter((r: any) => {
    return r.status === 'UnderReview' && (Date.now() - new Date(r.createdAt).getTime() > 86_400_000); // مر عليها 24 ساعة
  }).length;

  const resolutionRate = allReports.length > 0
    ? ((totalResolved / allReports.length) * 100).toFixed(1)
    : '0.0';

  // ─── 📈 بناء بيانات الشارت (الاتجاه اليومي) ديناميكياً ───
  const trendMap: Record<string, any> = {};
  allReports.forEach((r: any) => {
    const dateStr = new Date(r.createdAt).toISOString().split('T')[0]; // صيغة YYYY-MM-DD
    if (!trendMap[dateStr]) {
      trendMap[dateStr] = { date: dateStr, count: 0, resolvedCount: 0 };
    }
    trendMap[dateStr].count += 1;
    if (r.status === 'Resolved' || r.status === 'ReSolved') {
      trendMap[dateStr].resolvedCount += 1;
    }
  });
  
  // ترتيب الأيام من الأقدم للأحدث
  const dailyTrend = Object.values(trendMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-start">
      {/* Overdue alert banner */}
      {overdueCases > 0 && (
        <div className="bg-red-950/60 border border-red-600/50 text-red-200 p-4 rounded-xl flex items-center gap-3 shadow-lg shadow-red-900/20">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="font-semibold">
            {overdueCases === 1 
              ? t('authority_dashboard.overdue_banner_single', '⚠ 1 overdue case require immediate attention.') 
              : t('authority_dashboard.overdue_banner_plural', '⚠ {{count}} overdue cases require immediate attention.').replace('{{count}}', String(overdueCases))}
          </span>
          <Link to="/authority/feed?status=UnderReview" className="ms-auto text-sm text-red-400 underline hover:text-red-300">
            {t('authority_dashboard.view_overdue', 'View Overdue')}
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('authority_dashboard.total_assigned', 'Total Assigned')} value={totalAssigned} icon={<FileText />} color="#3b82f6" />
        <StatCard title={t('authority_dashboard.resolved', 'Resolved')} value={totalResolved} icon={<CheckCircle />} color="#10b981" />
        <StatCard 
          title={t('authority_dashboard.pending_overdue', 'Pending / Overdue')}
          value={`${totalPending} / ${overdueCases}`} 
          icon={<Clock />} 
          color="#f59e0b"
          dir="ltr"
        />
        <StatCard title={t('authority_dashboard.resolution_rate', 'Resolution Rate')} value={`${resolutionRate}%`} icon={<TrendingUp />} color="#8b5cf6" dir="ltr" />
      </div>

      {/* Chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 7-day trend */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t('authority_dashboard.activity_trend', '7-Day Activity Trend')}</h2>
          <DailyTrendChart data={dailyTrend} /> 
        </div>

        {/* Recent cases table */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">{t('authority_dashboard.recent_cases', 'Recent Cases')}</h2>
            <Link to="/authority/feed" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline">
              {t('authority_dashboard.view_all', 'View All')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </Link>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 border-b border-gray-800 bg-gray-800/50">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('authority_dashboard.table_title_category', 'Title / Category')}</span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-end">{t('authority_dashboard.table_status', 'Status')}</span>
            </div>

            <div className="divide-y divide-gray-800/60">
              {recentCasesForTable.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">{t('authority_dashboard.no_recent_cases', 'No recent cases assigned.')}</div>
              ) : (
                recentCasesForTable.map((report: any) => (
                  <div
                    key={report.id}
                    className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 hover:bg-gray-800/40 transition-colors items-center"
                  >
                    <div className="overflow-hidden text-start">
                      <p className="font-medium text-white text-sm truncate">{report.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 truncate">{report.categoryName || report.category}</span>
                        <span className="text-[11px] text-gray-600">•</span>
                        <span className="text-[11px] text-gray-600" dir="ltr">
                          {report.createdAt
                            ? formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: getStatusPinColor(report.status) }}
                      >
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                      <Link
                        to={`/authority/report/${report.id}`}
                        className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        {t('authority_dashboard.open', 'Open')} {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}