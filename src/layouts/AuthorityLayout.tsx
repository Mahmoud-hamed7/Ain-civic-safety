import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 استدعاء الترجمة
import {
  LayoutDashboard, ClipboardList, Map, AlertTriangle,
  BarChart3, Users, LogOut, Menu, XCircle, Siren, Globe // 👈 ضفنا Globe للغة
} from 'lucide-react';
import NotificationCenter from '../components/NotificationCenter';
import { useAuthStore } from '../store/authStore';
import ConnectionStatus from '../components/ConnectionStatus';
import { useSignalR } from '../providers/SignalRProvider';
import apiClient from '../api/client';
import { parseCommunityListFromResponse } from '../hooks/useCommunityNameMap';

// 👈 عدلنا المصفوفة عشان تاخد مفتاح الترجمة بدال النص الثابت
const navItems = [
  { to: '/authority/dashboard', tKey: 'dashboard', defaultStr: 'Dashboard',     icon: LayoutDashboard },
  { to: '/authority/feed',      tKey: 'case_feed', defaultStr: 'Case Feed',     icon: ClipboardList   },
  { to: '/authority/map',       tKey: 'map_view',  defaultStr: 'Map View',      icon: Map             },
  { to: '/authority/sos',       tKey: 'sos_monitor', defaultStr: 'SOS Monitor',   icon: AlertTriangle,  accent: true },
  { to: '/authority/analytics', tKey: 'analytics', defaultStr: 'Analytics',     icon: BarChart3       },
  { to: '/authority/communities', tKey: 'communities', defaultStr: 'Communities', icon: Users         },
];

export default function AuthorityLayout() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const user = useAuthStore((s) => s.user);
  const { joinCommunityGroup, leaveCommunityGroup, connectionState, sosBanner, dismissSosBanner } = useSignalR();
  const joinedGroupIds = useRef<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  const { data: jurisdictionCommunities } = useQuery({
    queryKey: ['community', 'all', 'authority-signalr'],
    queryFn: () =>
      apiClient
        .get('/api/Community/all', { params: { pageNumber: 1, pageSize: 1000 } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (connectionState !== 'Connected') return;
    const communities = parseCommunityListFromResponse(jurisdictionCommunities);
    const nextIds = new Set(communities.map((c) => c.id));
    for (const id of joinedGroupIds.current) {
      if (!nextIds.has(id)) { leaveCommunityGroup(id); joinedGroupIds.current.delete(id); }
    }
    for (const id of nextIds) {
      if (!joinedGroupIds.current.has(id)) { joinCommunityGroup(id); joinedGroupIds.current.add(id); }
    }
  }, [jurisdictionCommunities, connectionState, joinCommunityGroup, leaveCommunityGroup]);

  useEffect(() => {
    return () => {
      for (const id of joinedGroupIds.current) leaveCommunityGroup(id);
      joinedGroupIds.current.clear();
    };
  }, [leaveCommunityGroup]);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleLanguage = () => {
    const newLang = isRtl ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const navLinks = navItems.map(({ to, tKey, defaultStr, icon: Icon, accent }) => (
    <NavLink
      key={to}
      to={to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? accent
              ? 'bg-red-600/20 text-red-400 border border-red-600/30'
              : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
            : accent
              ? 'text-red-400/70 hover:bg-red-600/10 hover:text-red-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {/* 👈 ترجمة الناف بار هنا */}
      {t(`authority_layout.${tKey}`, defaultStr)}
      {accent && <span className="ms-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
    </NavLink>
  ));

  const profileFooter = (
    <div className="mt-auto border-t border-gray-800 p-3 bg-gray-900/50 flex items-center justify-between text-start">
      <Link
        to="/authority/profile"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 flex-1 min-w-0 px-2 py-2 rounded-xl hover:bg-gray-800 transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {(user?.displayName ?? 'A')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate group-hover:text-blue-400 transition-colors">
            {user?.displayName ?? t('authority_layout.authority_user', 'Authority User')}
          </p>
          <p className="text-[10px] text-gray-500 truncate">{t('authority_layout.authority_member', 'Authority Member')}</p>
        </div>
      </Link>

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
    <div className="flex h-screen bg-gray-950 text-white" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Desktop sidebar ─── */}
      <aside className="w-64 bg-gray-900 border-e border-gray-800 hidden md:flex flex-col">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3 text-start">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm shrink-0">A</div>
          <div className="min-w-0">
            <div className="font-bold text-blue-400 text-sm leading-tight truncate">{t('authority_layout.ain_authority', 'AIN Authority')}</div>
            <div className="text-[10px] text-gray-500 leading-tight truncate max-w-[140px]">
              {user?.displayName || t('authority_layout.authority_user', 'Authority User')}
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto text-start">{navLinks}</nav>
        {profileFooter}
      </aside>

      {/* ─── Mobile overlay ─── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Mobile drawer ─── */}
      <aside
        className={`fixed inset-y-0 start-0 w-64 bg-gray-900 border-e border-gray-800 z-50 flex flex-col transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3 text-start">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm shrink-0">A</div>
          <div className="min-w-0">
            <div className="font-bold text-blue-400 text-sm leading-tight truncate">{t('authority_layout.ain_authority', 'AIN Authority')}</div>
            <div className="text-[10px] text-gray-500 leading-tight truncate max-w-[110px]">
              {user?.displayName || t('authority_layout.authority_user', 'Authority User')}
            </div>
          </div>
          <button className="ms-auto text-gray-400 hover:text-white shrink-0" onClick={() => setMobileOpen(false)}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto text-start">{navLinks}</nav>
        {profileFooter}
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex justify-between items-center px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-semibold px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full hidden sm:block">
              {t('authority_layout.control_center', 'Authority Control Center')}
            </div>
          </div>
          <div className="flex items-center gap-5">
            {/* 👈 زرار تغيير اللغة هنا */}
            <button 
              onClick={toggleLanguage} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 rounded-full transition-colors border border-gray-700"
            >
              <Globe className="w-3.5 h-3.5" />
              {isRtl ? 'English' : 'عربي'}
            </button>

            <ConnectionStatus />
            <span className="text-sm text-gray-400 tabular-nums font-mono" dir="ltr">
              {time.toLocaleTimeString()}
            </span>
            <NotificationCenter />
          </div>
        </header>

        {/* Persistent SOS banner for authority users */}
        {sosBanner && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-red-600 border-b border-red-700 text-start">
            <Siren className="w-4 h-4 text-white shrink-0 animate-pulse" />
            <p className="flex-1 text-sm font-bold text-white truncate min-w-0" dir={isRtl ? "rtl" : "ltr"}>
              {t('authority_layout.sos_banner', '🚨 Emergency SOS in {{community}}!').replace('{{community}}', sosBanner.communityName)}
            </p>
            <Link
              to="/authority/sos"
              onClick={dismissSosBanner}
              className="text-xs font-semibold text-white/90 hover:text-white underline shrink-0"
            >
              {t('authority_layout.view', 'View')} {isRtl ? '←' : '→'}
            </Link>
            <button
              onClick={dismissSosBanner}
              aria-label="Dismiss SOS banner"
              className="text-white/70 hover:text-white transition-colors shrink-0"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}