/**
 * AdminSOS — v2
 */
import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Siren, CheckCircle, AlertTriangle, Clock, XCircle, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import { useSOSAlerts } from '../../api/sos';
import Skeleton from '../../components/Skeleton';
import { StatCard } from '../../components/Charts';
import { SOSPinsMap } from '../../components/Map';
import SOSBroadcastLabel from '../../components/SOS/SOSBroadcastLabel';
import { useCommunityNameMap, resolveCommunityName } from '../../hooks/useCommunityNameMap';
import { useNotificationStore } from '../../store/notificationStore';

const STATUS_TABS = ['Active', 'Resolved', 'Cancelled', 'FalseAlarm', 'Expired'] as const;
type StatusTab = (typeof STATUS_TABS)[number] | 'All';

const SEVERITY_COLORS: Record<string, string> = {
  Standard: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  High:     'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${SEVERITY_COLORS[severity] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
      {severity === 'Critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
      {t(`sos.severities.${severity}`, severity)}
    </span>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void; }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-800">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
      <span className="text-xs text-gray-400 tabular-nums" dir="ltr">
        {currentPage} / {totalPages}
      </span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminSOS() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const dateLocale = isRtl ? ar : enUS;

  const qc = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const communityNameMap = useCommunityNameMap();

  const [statusFilter, setStatusFilter] = useState<StatusTab>('Active');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['admin', 'sos-overview'],
    queryFn:  () => apiClient.get('/api/admin/sos/overview').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: activeCountData } = useSOSAlerts({ status: 'Active', pageSize: 1 });
  const activeCount = activeCountData?.totalCount ?? overview?.activeAlerts ?? 0;

  const filters = {
    ...(statusFilter !== 'All' ? { status: statusFilter } : {}),
    page: currentPage,
    pageSize: 20,
  };
  const { data: alertsData, isLoading: loadingAlerts } = useSOSAlerts(filters);

  const alerts = alertsData?.data ?? [];
  const totalPages = alertsData?.totalPages ?? 1;
  const staleCount = alerts.filter((a) => a.isLocationStale).length;

  const handleStatusChange = (tab: StatusTab) => {
    setStatusFilter(tab);
    setCurrentPage(1);
  };

  const action = (id: string, endpoint: string, msg: string) =>
    apiClient.put(`/api/sosalerts/${id}/${endpoint}`)
      .then(() => {
        addToast({ type: 'success', title: 'Done', description: msg });
        qc.invalidateQueries({ queryKey: ['sos'] });
        qc.invalidateQueries({ queryKey: ['admin', 'sos-overview'] });
      })
      .catch((e: any) =>
        addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Action failed.' })
      );

  if (loadingOverview) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} type="card" className="h-24" />)}
        </div>
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-start">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('admin_sos_monitor.title', 'SOS Monitor')}</h1>
        {activeCount > 0 && (
          <span className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            {t('admin_sos_monitor.alerts_count', '{{count}} Active Alerts').replace('{{count}}', String(activeCount))}
          </span>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('admin_sos_monitor.active_alerts', 'Active Alerts')} value={activeCount} icon={<Siren className="w-5 h-5" />} color="#ef4444" subtitle={activeCount > 0 ? t('admin.requires_attention', 'Requires attention') : t('admin.all_clear', 'All clear')} />
        <StatCard title={t('admin_sos_monitor.resolved_today', 'Resolved Today')} value={overview?.resolvedToday ?? 0} icon={<CheckCircle className="w-5 h-5" />} color="#10b981" />
        <StatCard title={t('admin_sos_monitor.false_alarms', 'False Alarms Today')} value={overview?.falseAlarmsToday ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color="#f59e0b" />
        <StatCard title={t('admin_sos_monitor.avg_response', 'Avg Response')} value={`${(overview?.avgResponseMinutes ?? 0).toFixed(0)}m`} icon={<Clock className="w-5 h-5" />} color="#3b82f6" />
      </div>

      {/* Map + Alert list */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Map */}
        <div className="xl:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold text-white">{t('admin_sos_monitor.live_map', 'Live SOS Map')}</h2>
          </div>
          <div className="h-80">
            <SOSPinsMap showActions={true} height="100%" />
          </div>
        </div>

        {/* Alert list */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="px-3 pt-3 border-b border-gray-800">
            <div className="flex gap-1 flex-wrap pb-3">
              {(['All', ...STATUS_TABS] as StatusTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleStatusChange(tab)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    statusFilter === tab
                      ? tab === 'Active'
                        ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                        : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                      : 'border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {t(`admin_sos_monitor.tabs.${tab}`, tab)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs text-gray-500">{alertsData?.totalCount ?? 0} {t('common.alerts', 'alerts')}</span>
              {staleCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400">
                  <WifiOff className="w-3 h-3" /> {staleCount} {t('admin_sos_monitor.stale_location', 'stale location')}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingAlerts ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} type="card" className="h-20" />)}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
                <p className="text-sm text-gray-400">{t('admin_sos_monitor.no_alerts', 'No alerts')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        {alert.isLocationStale && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                            <WifiOff className="w-2.5 h-2.5" /> {t('admin_sos_monitor.stale_location', 'Stale')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatDistanceToNow(new Date(alert.createdAtUtc), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </div>
                    {alert.message && (
                      <p className="text-xs text-gray-300 mb-2 line-clamp-2 text-start">{alert.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mb-1 text-start">
                      {resolveCommunityName(communityNameMap, alert.communityId)}
                    </p>
                    <SOSBroadcastLabel
                      communityId={alert.communityId}
                      affectedCommunityIds={alert.affectedCommunityIds}
                      nameMap={communityNameMap}
                      className="text-[10px] text-indigo-400 mb-3"
                    />
                    {alert.status === 'Active' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => action(alert.id, 'resolve', 'Alert resolved.')}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {t('admin_sos_monitor.resolve', 'Resolve')}
                        </button>
                        <button
                          onClick={() => action(alert.id, 'false-alarm', 'Marked as false alarm.')}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> {t('admin_sos_monitor.false_alarm', 'False Alarm')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Authority breakdown */}
      {(overview?.alertsByAuthority?.length ?? 0) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">{t('admin.by_authority', 'Alerts by Authority')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.alertsByAuthority.map((a: any) => (
              <div key={a.authorityName} className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700">
                <span className="text-sm font-medium text-gray-300 truncate">{a.authorityName}</span>
                <div className="flex gap-4 shrink-0 ms-3 text-xs">
                  <span className="text-red-400 font-bold">{a.active} {t('admin.active', 'active')}</span>
                  <span className="text-emerald-400">{a.resolvedToday} {t('admin.resolved', 'resolved')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}