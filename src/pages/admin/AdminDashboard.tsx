import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  Users, Building2, AlertTriangle, FileText,
  Clock, Siren, Activity, Link2, Plus, UserX,
  CheckCircle, TrendingUp,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import { StatCard } from '../../components/Charts';
import LinkAuthorityModal from '../../components/LinkAuthorityModal';

function QuickAction({ to, icon: Icon, label, color }: { to: string; icon: any; label: string; color: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 bg-gray-800/50 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all"
    >
      <Icon className="w-4 h-4" style={{ color }} />
      {label}
    </Link>
  );
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const dateLocale = isRtl ? ar : enUS;

  const [showLinkModal, setShowLinkModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn:  () => apiClient.get('/api/admin/dashboard-summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: sosOverview } = useQuery({
    queryKey: ['admin', 'sos-overview'],
    queryFn:  () => apiClient.get('/api/admin/sos/overview').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="card" className="h-28" />)}
        </div>
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  const health = (data?.systemHealth ?? 'operational').toLowerCase();
  const healthBanner =
    health === 'operational'
      ? { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: <CheckCircle className="w-4 h-4" />, msg: t('admin.systems_operational', 'All Systems Operational') }
      : health === 'degraded'
      ? { bg: 'bg-amber-500/10 border-amber-500/30',   text: 'text-amber-400',   icon: <AlertTriangle className="w-4 h-4" />, msg: t('admin.system_degraded', 'System Degraded') }
      : { bg: 'bg-red-500/10 border-red-500/30',       text: 'text-red-400',     icon: <AlertTriangle className="w-4 h-4" />, msg: t('admin.system_outage', 'System Outage') };

  const authorityPerf: any[] = sosOverview?.alertsByAuthority ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.dashboard', 'Admin Dashboard')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data?.generatedAt ? `${t('common.updated', 'Updated')} ${format(new Date(data.generatedAt), 'MMM d, HH:mm', { locale: dateLocale })}` : t('common.system_overview', 'System overview')}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <Link2 className="w-4 h-4" /> {t('admin.link_user', 'Link User')}
          </button>
          <QuickAction to="/admin/authorities" icon={Plus}    label={t('admin.create_authority', 'Create Authority')} color="#10b981" />
          <QuickAction to="/admin/users"       icon={UserX}   label={t('admin.unlinked_users', 'Unlinked Users')}   color="#f59e0b" />
        </div>
      </div>

      {/* System Health Banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${healthBanner.bg} ${healthBanner.text}`}>
        {healthBanner.icon}
        {healthBanner.msg}
        {data?.activeSOS > 0 && (
          <Link to="/admin/sos" className="ms-auto text-xs font-bold underline underline-offset-2 hover:opacity-80 transition-opacity">
            {data.activeSOS} {t('admin.active_sos', 'Active SOS')} {isRtl ? '←' : '→'}
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title={t('admin.total_users', 'Total Users')}       value={data?.totalUsers           ?? 0} icon={<Users className="w-5 h-5" />}         color="#3b82f6" />
        <StatCard title={t('admin.authorities', 'Authorities')}       value={data?.totalAuthorities     ?? 0} icon={<Building2 className="w-5 h-5" />}      color="#8b5cf6" />
        <StatCard title={t('admin.unlinked_auth', 'Unlinked Auth.')}   value={data?.unlinkedAuthorities  ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color="#f59e0b" />
        <StatCard title={t('admin.total_reports', 'Total Reports')}   value={data?.totalReports         ?? 0} icon={<FileText className="w-5 h-5" />}       color="#10b981" />
        <StatCard title={t('admin.active_reports', 'Active Reports')} value={data?.activeReports        ?? 0} icon={<Clock className="w-5 h-5" />}          color="#f97316" />
        <StatCard
          title={t('admin.active_sos', 'Active SOS')}
          value={data?.activeSOS ?? 0}
          icon={<Siren className="w-5 h-5" />}
          color="#ef4444"
          subtitle={data?.activeSOS > 0 ? t('admin.requires_attention', 'Requires attention') : t('admin.all_clear', 'All clear')}
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Today's summary */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> {t('admin.todays_activity', "Today's Activity")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('admin.reports_today', 'Reports Today'),  value: data?.reportsToday  ?? 0, color: '#10b981', icon: <TrendingUp className="w-4 h-4" /> },
              { label: t('admin.resolved_today', 'Resolved Today'), value: data?.resolvedToday ?? 0, color: '#3b82f6', icon: <CheckCircle className="w-4 h-4" /> },
              { label: t('admin.linked_auth', 'Linked Auth.'),   value: data?.linkedAuthorities ?? 0, color: '#8b5cf6', icon: <Link2 className="w-4 h-4" /> },
              { label: t('admin.active_sos', 'Active SOS'),     value: data?.activeSOS ?? 0, color: '#ef4444', icon: <Siren className="w-4 h-4" /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-1" style={{ color }}>
                  {icon}
                  <span className="text-xs font-medium text-gray-400">{label}</span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Quick nav links */}
          <div className="pt-2 border-t border-gray-800 space-y-1">
            {[
              { to: '/admin/users',       label: t('admin.manage_users', 'Manage Users') },
              { to: '/admin/reports',     label: t('admin.moderate_reports', 'Moderate Reports') },
              { to: '/admin/authorities', label: t('admin.manage_authorities', 'Manage Authorities') },
            ].map(({ to, label }) => (
              <Link key={to} to={to} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors w-fit">
                {isRtl ? '←' : '→'} {label} 
              </Link>
            ))}
          </div>
        </div>

        {/* SOS Overview Panel */}
        <div className="xl:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Siren className="w-4 h-4 text-red-400" /> {t('admin.sos_overview', 'SOS Overview')}
            </h2>
            <Link to="/admin/sos" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              {t('admin.full_sos_monitor', 'Full SOS Monitor')} {isRtl ? '←' : '→'}
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('admin.active', 'Active'),        value: sosOverview?.activeAlerts      ?? 0, color: '#ef4444' },
              { label: t('admin.resolved_today', 'Resolved Today'),value: sosOverview?.resolvedToday     ?? 0, color: '#10b981' },
              { label: t('admin.avg_response', 'Avg Response'),  value: `${(sosOverview?.avgResponseMinutes ?? 0).toFixed(0)}m`, color: '#3b82f6' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700 text-center">
                <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-start">{t('admin.by_authority', 'By Authority')}</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {authorityPerf.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('admin.no_active_sos', 'No active SOS alerts')}</p>
              ) : (
                authorityPerf.map((a: any) => (
                  <div key={a.authorityName} className="flex items-center justify-between px-3 py-2 bg-gray-800/40 rounded-lg border border-gray-800 text-sm">
                    <span className="text-gray-300 font-medium truncate">{a.authorityName}</span>
                    <div className="flex gap-3 shrink-0 ms-4">
                      <span className="text-red-400 font-bold tabular-nums">{a.active} {t('admin.active', 'active')}</span>
                      <span className="text-emerald-400 tabular-nums">{a.resolvedToday} {t('admin.resolved', 'resolved')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <LinkAuthorityModal open={showLinkModal} onClose={() => setShowLinkModal(false)} />
    </div>
  );
}