import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { Download, TrendingUp, CheckCircle, Clock, AlertCircle, AlertTriangle, Timer } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import Skeleton from '../../components/Skeleton';
import Button from '../../components/Button';
import {
  StatCard, DailyTrendChart, CategoryBarChart, StatusDonutChart, ResolutionGauge,
} from '../../components/Charts';

export default function AuthorityAnalytics() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const user = useAuthStore((s) => s.user);
  
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  // 2️⃣ الكود المؤقت (Mock Data)
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'analytics', 'mock', dateFrom, dateTo],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500)); 
      return {
        totalAssigned: 20,
        totalResolved: 3,
        totalPending: 14,
        overdueCases: 2,
        slaMissedRate: 0.15,
        avgResponseTimeHours: 12.5,
        avgResolutionTimeHours: 48.2,
        resolutionRate: 0.15,
        reportsByStatus: {
          Resolved: 3,
          UnderReview: 14,
          Dispatched: 2,
          Rejected: 1
        },
        reportsByCategory: {
          "الأمن العام / Public Security": 12,
          "البنية التحتية / Infrastructure": 5,
          "طوارئ طبية / Medical Emergency": 3
        },
        dailyTrend: [
          { date: "2026-06-17T00:00:00", count: 2, resolvedCount: 0 },
          { date: "2026-06-18T00:00:00", count: 5, resolvedCount: 1 },
          { date: "2026-06-19T00:00:00", count: 3, resolvedCount: 1 },
          { date: "2026-06-20T00:00:00", count: 7, resolvedCount: 0 },
          { date: "2026-06-21T00:00:00", count: 3, resolvedCount: 1 }
        ]
      };
    },
  });
  // ==============================================================================
  // 1️⃣ الكود الأصلي الحقيقي (عشان ترجعله لما الباك إند يتظبط)
  // ==============================================================================
  /*
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'analytics', 'authority', user?.authorityId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/reports/analytics/authority/${user?.authorityId}`,
        { params: { startDate: new Date(dateFrom).toISOString(), endDate: new Date(dateTo + 'T23:59:59').toISOString() } }
      );
      return res.data;
    },
    enabled: !!user?.authorityId,
  });
  */

  const exportData = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `analytics_${dateFrom}_to_${dateTo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resolutionPct =
    typeof data?.resolutionRate === 'number'
      ? +(data.resolutionRate * (data.resolutionRate <= 1 ? 100 : 1)).toFixed(1)
      : 0;

  const statusChartData = Object.entries(data?.reportsByStatus ?? {}).map(([name, value]) => ({
    name: name === 'ReSolved' || name === 'Resolved' ? t('status.Resolved', 'Resolved') : t(`status.${name}`, name),
    value: value as number,
  }));

  const categoryData = Object.entries(data?.reportsByCategory ?? {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map((n) => <Skeleton key={n} type="card" className="h-24" />)}
        </div>
        <Skeleton type="chart" className="h-64" />
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-start">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">{t('authority_analytics.title', 'Performance Analytics')}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
            />
            <span className="text-gray-600">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
            />
          </div>
          <Button variant="outline" onClick={exportData} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> {t('authority_analytics.export_json', 'Export JSON')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title={t('authority_analytics.total_assigned', 'Total Assigned')} value={data?.totalAssigned ?? 0} icon={<TrendingUp className="w-5 h-5" />} color="#3b82f6" />
        <StatCard title={t('authority_analytics.resolved', 'Resolved')} value={data?.totalResolved ?? 0} icon={<CheckCircle className="w-5 h-5" />} color="#10b981" />
        <StatCard title={t('authority_analytics.pending', 'Pending')} value={data?.totalPending ?? 0} icon={<Clock className="w-5 h-5" />} color="#f59e0b" />
        <StatCard title={t('authority_analytics.overdue_cases', 'Overdue Cases')} value={data?.overdueCases ?? 0} icon={<AlertCircle className="w-5 h-5" />} color="#ef4444" />
        <StatCard
          title={t('authority_analytics.sla_missed', 'SLA Missed')}
          value={`${((data?.slaMissedRate ?? 0) * 100).toFixed(1)}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#f97316"
        />
        <StatCard
          title={t('authority_analytics.avg_response', 'Avg Response')}
          value={`${(data?.avgResponseTimeHours ?? 0).toFixed(1)}h`}
          icon={<Timer className="w-5 h-5" />}
          color="#8b5cf6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-bold text-white mb-2 self-start">{t('authority_analytics.resolution_rate', 'Resolution Rate')}</h3>
          <ResolutionGauge rate={resolutionPct} size={200} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 text-start">{t('authority_analytics.status_distribution', 'Status Distribution')}</h3>
          <StatusDonutChart data={statusChartData} height={220} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 text-start">{t('authority_analytics.avg_response_time', 'Avg Response Time')}</h3>
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <p className="text-5xl font-black text-purple-400 tabular-nums" dir="ltr">
                {(data?.avgResponseTimeHours ?? 0).toFixed(1)}
              </p>
              <p className="text-gray-500 text-sm mt-1">{t('authority_analytics.hours_average', 'hours average')}</p>
              <p className="text-xs text-gray-600 mt-2">
                {t('authority_analytics.resolution_avg', 'Resolution avg: {{hours}}h').replace('{{hours}}', (data?.avgResolutionTimeHours ?? 0).toFixed(1))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 text-start">{t('authority_analytics.daily_trend', 'Daily Volume & Resolution Trend')}</h3>
        <DailyTrendChart data={data?.dailyTrend ?? []} height={240} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 text-start">{t('authority_analytics.reports_by_category', 'Reports by Category')}</h3>
        <CategoryBarChart data={categoryData} height={220} />
      </div>
    </div>
  );
}