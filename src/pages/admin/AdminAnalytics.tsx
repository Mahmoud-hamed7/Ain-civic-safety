import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";
import {
  FileText,
  CheckCircle,
  Clock,
  Timer,
  TrendingUp,
  Users,
  Download,
  AlertTriangle,
} from "lucide-react";
import apiClient from "../../api/client";
import Skeleton from "../../components/Skeleton";
import {
  StatCard,
  DailyTrendChart,
  StatusDonutChart,
  CategoryBarChart,
  VisibilityChart,
  ResolutionGauge,
  AuthorityPerformanceTable,
  type AuthorityPerformanceRow,
} from "../../components/Charts";

export default function AdminAnalytics() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("ar");
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "analytics", "system", dateFrom, dateTo],
    queryFn: async () => {
      const res = await apiClient.get("/api/reports/analytics/system", {
        params: {
          startDate: new Date(dateFrom).toISOString(),
          endDate: new Date(dateTo + "T23:59:59").toISOString(),
        },
      });
      return res.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["admin", "dashboard-summary"],
    queryFn: async () =>
      (await apiClient.get("/api/admin/dashboard-summary")).data,
  });

  const resolutionPct = (() => {
    const r = data?.overallResolutionRate ?? 0;
    return r <= 1 ? +(r * 100).toFixed(1) : +r.toFixed(1);
  })();

  const statusData = Object.entries(data?.reportsByStatus ?? {}).map(
    ([name, value]) => ({
      name:
        name === "ReSolved"
          ? t("status.Resolved", "Resolved")
          : t(`status.${name}`, name),
      value: value as number,
    }),
  );

  const categoryData = Object.entries(data?.reportsByCategory ?? {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  const visibilityData = Object.entries(data?.reportsByVisibility ?? {}).map(
    ([name, value]) => ({
      name: t(`visibility.${name.toLowerCase()}`, name),
      value: value as number,
    }),
  );

  const perfRows: AuthorityPerformanceRow[] = Object.entries(
    data?.authorityPerformance ?? {},
  ).map(([, perf]: [string, any]) => ({
    authorityId: perf.authorityName ?? Math.random().toString(),
    authorityName: perf.authorityName ?? "—",
    totalAssigned: perf.reportsAssigned ?? 0,
    totalResolved: perf.reportsResolved ?? 0,
    resolutionRate:
      perf.resolutionRate != null
        ? perf.resolutionRate <= 1
          ? perf.resolutionRate * 100
          : perf.resolutionRate
        : 0,
    avgResponseTimeHours: perf.avgResolutionTimeHours ?? 0,
  }));

  const exportData = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `system_analytics_${dateFrom}_to_${dateTo}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} type="card" className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton type="chart" className="h-72" />
          <Skeleton type="chart" className="h-72" />
        </div>
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-start">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {t("admin_analytics.title", "System Analytics")}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {t(
              "admin_analytics.subtitle",
              "Platform-wide performance overview",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
            />
            <span className="text-gray-600 font-medium">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
            />
          </div>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />{" "}
            {t("admin_analytics.export_json", "Export JSON")}
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title={t("admin_analytics.total_reports", "Total Reports")}
          value={data?.totalReports ?? summary?.totalReports ?? 0}
          icon={<FileText className="w-5 h-5" />}
          color="#3b82f6"
          subtitle={t("admin_analytics.period_total", "Period total")}
        />
        <StatCard
          title={t("admin_analytics.total_resolved", "Total Resolved")}
          value={data?.totalResolved ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="#10b981"
          subtitle={t("admin_analytics.cases_closed", "Cases closed")}
        />
        <StatCard
          title={t("admin_analytics.pending", "Pending")}
          value={data?.totalPending ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="#f59e0b"
          subtitle={t("admin_analytics.awaiting_action", "Awaiting action")}
        />
        <StatCard
          title={t("admin_analytics.active_users", "Active Users")}
          value={summary?.totalUsers ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="#8b5cf6"
          subtitle={t("admin_analytics.registered_users", "Registered users")}
        />
        <StatCard
          title={t("admin_analytics.avg_response", "Avg Response")}
          value={`${(data?.avgResponseTimeHours ?? 0).toFixed(1)}h`}
          icon={<Timer className="w-5 h-5" />}
          color="#06b6d4"
          subtitle={t("admin_analytics.mean_response", "Mean response time")}
        />
        <StatCard
          title={t("admin_analytics.active_sos", "Active SOS")}
          value={summary?.activeSOS ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#ef4444"
          subtitle={t("admin_analytics.live_alerts", "Live alerts")}
        />
      </div>

      {/* ── Row 2 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center gap-2">
          <h3 className="text-base font-bold text-white self-start">
            {t("admin_analytics.resolution_rate", "Resolution Rate")}
          </h3>
          <ResolutionGauge rate={resolutionPct} size={200} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 text-start">
            {t("admin_analytics.status_dist", "Status Distribution")}
          </h3>
          <StatusDonutChart data={statusData} height={220} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 text-start">
            {t("admin_analytics.visibility_breakdown", "Visibility Breakdown")}
          </h3>
          <VisibilityChart data={visibilityData} height={220} />
        </div>
      </div>

      {/* ── Row 3 ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">
            {t(
              "admin_analytics.daily_trend",
              "Daily Volume & Resolution Trend",
            )}
          </h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            <TrendingUp
              className={`w-3.5 h-3.5 inline ${isRtl ? "ml-1" : "mr-1"}`}
            />
            {data?.dailyTrend?.length ?? 0} {t("common.days", "days")}
          </span>
        </div>
        <DailyTrendChart data={data?.dailyTrend ?? []} height={260} />
      </div>

      {/* ── Row 4 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 text-start">
            {t("admin_analytics.reports_by_cat", "Reports by Category")}
          </h3>
          <CategoryBarChart data={categoryData} height={280} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center gap-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t("admin_analytics.avg_response", "Avg Response")}
            </p>
            <p
              className="text-5xl font-black tabular-nums text-cyan-400"
              dir="ltr"
            >
              {(data?.avgResponseTimeHours ?? 0).toFixed(1)}
              <span className="text-2xl font-bold text-gray-500 mx-1">h</span>
            </p>
          </div>
          <div className="w-px h-8 bg-gray-800 mx-auto" />
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t("admin_analytics.avg_resolution", "Avg Resolution")}
            </p>
            <p
              className="text-5xl font-black tabular-nums text-purple-400"
              dir="ltr"
            >
              {(data?.avgResolutionTimeHours ?? 0).toFixed(1)}
              <span className="text-2xl font-bold text-gray-500 mx-1">h</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 5 ── */}
      {perfRows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 text-start">
            {t("admin_analytics.auth_performance", "Authority Performance")}
          </h3>
          <AuthorityPerformanceTable data={perfRows} />
        </div>
      )}
    </div>
  );
}
