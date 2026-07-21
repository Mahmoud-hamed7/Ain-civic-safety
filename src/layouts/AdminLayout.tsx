import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom'; // 👈 شيلنا Link لأننا مش محتاجينها للبروفايل
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import NotificationCenter from '../components/NotificationCenter';
import ConnectionStatus from '../components/ConnectionStatus';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';
import {
  LayoutDashboard, Users, Building2, FileText, Tag, Layers,
  Siren, BarChart3, Map, Settings, Users2, ShieldCheck,
  LogOut, Globe, Menu, XCircle
} from 'lucide-react';

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const user = useAuthStore((state) => state.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const navLinksList = [
    { to: '/admin/dashboard',    icon: LayoutDashboard, label: t('admin.dashboard', 'Dashboard') },
    { to: '/admin/users',        icon: Users,           label: t('admin.users', 'Users') },
    { to: '/admin/authorities',  icon: Building2,       label: t('admin.authorities', 'Authorities') },
    { to: '/admin/reports',      icon: FileText,        label: t('admin.reports', 'Reports') },
    { to: '/admin/categories',   icon: Tag,             label: t('admin.categories', 'Categories') },
    { to: '/admin/specializations', icon: Layers,       label: t('admin.specializations', 'Specializations') },
    { to: '/admin/communities',  icon: Users2,          label: t('admin.communities', 'Communities') },
    { to: '/admin/sos',          icon: Siren,           label: t('admin.sos_monitor', 'SOS Monitor'), sos: true },
    { to: '/admin/analytics',    icon: BarChart3,       label: t('admin.analytics', 'Analytics') },
    { to: '/admin/map',          icon: Map,             label: t('admin.system_map', 'System Map') },
  ];

  const isSuperAdmin = Array.isArray(user?.role)
    ? user.role.includes('SuperAdmin')
    : user?.role === 'SuperAdmin';

  const { data: summary } = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn:  () => apiClient.get('/api/admin/dashboard-summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const activeSOS: number = summary?.activeSOS ?? 0;
  const health = (summary?.systemHealth ?? 'operational').toLowerCase();
  const healthColor =
    health === 'operational' ? 'text-emerald-400' :
    health === 'degraded'    ? 'text-amber-400'   : 'text-red-400';

  const toggleLanguage = () => {
    const newLang = isRtl ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const navLinksContent = (
    <>
      {navLinksList.map(({ to, icon: Icon, label, sos }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              isActive
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-white'}`} />
              <span className="flex-1">{label}</span>
              {sos && activeSOS > 0 && (
                <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  {activeSOS}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}

      {isSuperAdmin && (
        <NavLink
          to="/superadmin/roles"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mt-4 border border-dashed transition-all ${
              isActive
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                : 'text-amber-500/70 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-400'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>{t('admin.role_management', 'Role Management')}</span>
        </NavLink>
      )}
    </>
  );

  // 👈 التعديل هنا: تحويل Link إلى div عادي عشان ميفتحش صفحة
  const profileFooter = (
    <div className="mt-auto border-t border-gray-800 p-3 bg-gray-900/50 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0 px-2 py-2 rounded-xl group cursor-default">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {(user?.displayName ?? 'A')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">
            {user?.displayName ?? t('admin.admin_title', 'Admin')}
          </p>
          <p className="text-[10px] text-gray-500 truncate">
            {isSuperAdmin ? t('admin.super_admin', 'Super Admin') : t('admin.administrator', 'Administrator')}
          </p>
        </div>
      </div>
      <button 
        onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }} 
        className="p-2 ms-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors shrink-0"
        title={t('common.logout', 'Logout')}
      >
        <LogOut size={18} className={isRtl ? "rotate-180" : ""} />
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Desktop Sidebar ── */}
      <aside className="w-60 shrink-0 bg-gray-900 border-e border-gray-800 hidden md:flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">AIN Admin</span>
          {isSuperAdmin && (
            <span className="ms-auto text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
              ROOT
            </span>
          )}
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navLinksContent}
        </nav>
        {isSuperAdmin && (
          <div className="p-3 border-t border-gray-800 bg-amber-950/20">
            <p className="text-[10px] font-bold text-amber-500 tracking-widest uppercase text-center">
              ⭐ {t('admin.super_admin_mode', 'Super Admin Mode')}
            </p>
          </div>
        )}
        {profileFooter}
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 start-0 w-60 bg-gray-900 border-e border-gray-800 z-50 flex flex-col transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">AIN Admin</span>
          <button className="ms-auto text-gray-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navLinksContent}
        </nav>
        {profileFooter}
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${activeSOS > 0 ? 'bg-red-400 animate-pulse' : health === 'operational' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`text-xs font-medium ${healthColor}`}>
                {health === 'operational' ? t('admin.systems_operational', 'All Systems Operational') : t(`admin.system_${health}`, `System ${health}`)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {activeSOS > 0 && (
              <NavLink to="/admin/sos" className="hidden sm:flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-red-500/20 transition-colors">
                <Siren className="w-3.5 h-3.5" />
                {activeSOS} {t('admin.active_sos', 'Active SOS')}
              </NavLink>
            )}
            
            <button 
              onClick={toggleLanguage} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 rounded-full transition-colors border border-gray-700"
            >
              <Globe className="w-3.5 h-3.5" />
              {isRtl ? 'English' : 'عربي'}
            </button>

            <ConnectionStatus />
            <NotificationCenter />
            
            {/* 👈 التعديل هنا: شيلنا الجزء بتاع اسم اليوزر اللي كان فوق خالص */}

          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}