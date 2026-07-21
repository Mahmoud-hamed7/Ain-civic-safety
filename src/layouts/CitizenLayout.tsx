/**
 * CitizenLayout — Premium sidebar layout for the citizen dashboard.
 * Joins / leaves SignalR community groups on mount.
 */
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 استدعاء مكتبة الترجمة
import {
  Newspaper, Map, FileText, Plus, Siren, Users,
  Shield, LogOut, AlertTriangle, XCircle, Menu, Globe
} from 'lucide-react';
import { communityApi } from '../api/community';
import { communityKeys } from '../queryKeys';
import { hasAnyLocationPending } from '../utils/citizenCommunities';
import NotificationCenter from '../components/NotificationCenter';
import ConnectionStatus from '../components/ConnectionStatus';
import { useSignalR } from '../providers/SignalRProvider';
import { useAuthStore, useAuthUserId } from '../store/authStore';

export default function CitizenLayout() {
  const { t, i18n } = useTranslation(); // 👈 تعريف دوال الترجمة
  const user    = useAuthStore((s) => s.user);
  const userId  = useAuthUserId();
  const { joinCommunityGroup, leaveCommunityGroup, connectionState, sosBanner, dismissSosBanner } = useSignalR();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: communities } = useQuery({
    queryKey: communityKeys.myList(),
    queryFn:  () => communityApi.getMyCommunities(userId),
  });

  useEffect(() => {
    if (!communities?.length || connectionState !== 'Connected') return;
    communities.forEach((c) => joinCommunityGroup(c.id));
    return () => { communities.forEach((c) => leaveCommunityGroup(c.id)); };
  }, [communities, joinCommunityGroup, leaveCommunityGroup, connectionState]);

  // 👈 نقلنا الـ navItems جوه عشان نقدر نستخدم دالة الترجمة t()
  const navItems = [
    { to: '/citizen/feed',        label: t('nav.public_feed', 'Public Feed'),    icon: Newspaper  },
    { to: '/citizen/map',         label: t('nav.map', 'Map'),                    icon: Map        },
    { to: '/citizen/my-reports',  label: t('nav.my_reports', 'My Reports'),      icon: FileText   },
    { to: '/citizen/report/new',  label: t('nav.submit_report', 'Submit Report'),icon: Plus       },
    { to: '/citizen/communities', label: t('nav.communities', 'Communities'),    icon: Users      },
  ];

  const SOS_ITEM = { to: '/citizen/sos', label: t('nav.sos_emergency', 'SOS Emergency'), icon: Siren };

  // دالة لتغيير اللغة
  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('ar') ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  // ظبط اتجاه الـ Drawer بتاع الموبايل بناءً على اللغة
  const isRtl = i18n.language.startsWith('ar');
  const drawerTransform = mobileOpen 
    ? 'translate-x-0' 
    : (isRtl ? 'translate-x-full' : '-translate-x-full');

  const navLinks = (
    <>
      {navItems.map(({ to, label, icon: Icon }) => (
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
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      <NavLink
        to={SOS_ITEM.to}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold mt-3 transition-all ${
            isActive
              ? 'bg-red-600/30 text-red-300 border border-red-500/40'
              : 'text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20'
          }`
        }
      >
        <Siren className="w-4 h-4 shrink-0" />
        <span>{SOS_ITEM.label}</span>
        {/* استخدمنا ms-auto بدل ml-auto عشان تشتغل يمين وشمال */}
        <span className="ms-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      </NavLink>
    </>
  );

  const profileFooter = (
    <div className="mt-auto border-t border-gray-800 p-3 bg-gray-900/50 flex items-center justify-between">
      <Link
        to="/citizen/profile"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 flex-1 min-w-0 px-2 py-2 rounded-xl hover:bg-gray-800 transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold shrink-0">
          {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate group-hover:text-indigo-300 transition-colors">
            {user?.displayName ?? user?.email ?? t('common.citizen', 'Citizen')}
          </p>
          <p className="text-[10px] text-gray-500 truncate">{t('common.citizen', 'Citizen')}</p>
        </div>
      </Link>
      
      <button
        onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login'; }}
        className="p-2 mx-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors shrink-0"
        title={t('common.logout', 'Logout')}
      >
        <LogOut size={18} className={isRtl ? "rotate-180" : ""} />
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      {/* استخدمنا border-e بدل border-r */}
      <aside className="w-60 shrink-0 bg-gray-900 border-e border-gray-800 hidden md:flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{t('common.ain', 'AIN')}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{t('common.citizen_portal', 'Citizen Portal')}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">{navLinks}</nav>
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
        className={`fixed inset-y-0 start-0 w-60 bg-gray-900 border-e border-gray-800 z-50 flex flex-col transition-transform duration-300 md:hidden ${drawerTransform}`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{t('common.ain', 'AIN')}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{t('common.citizen_portal', 'Citizen Portal')}</p>
          </div>
          <button className="ms-auto text-gray-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">{navLinks}</nav>
        {profileFooter}
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-5 gap-3">
          <button
            className="md:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 ms-auto">
            {/* 👈 زرار تغيير اللغة */}
            <button 
              onClick={toggleLanguage} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 rounded-full transition-colors border border-gray-700"
            >
              <Globe className="w-3.5 h-3.5" />
              {isRtl ? 'English' : 'عربي'}
            </button>
            
            <ConnectionStatus />
            <NotificationCenter />
          </div>
        </header>

        {/* Persistent SOS banner */}
        {sosBanner && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-red-600 border-b border-red-700">
            <Siren className="w-4 h-4 text-white shrink-0 animate-pulse" />
            <p className="flex-1 text-sm font-bold text-white truncate min-w-0">
              🚨 {t('common.emergency_sos_in', 'Emergency SOS in')} {sosBanner.communityName}!
            </p>
            <Link
              to="/citizen/sos"
              onClick={dismissSosBanner}
              className="text-xs font-semibold text-white/90 hover:text-white underline shrink-0"
            >
              {t('common.view', 'View')} →
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
          {hasAnyLocationPending(communities ?? []) && (
            <div className="mx-4 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">
                  {t('common.location_not_set', 'Location not set')}
                </p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  {t('common.sos_inactive_location', 'SOS emergency features are inactive until you share your location.')}
                </p>
              </div>
              <Link to="/citizen/profile" className="text-xs font-semibold text-amber-300 hover:text-amber-200 shrink-0">
                {t('common.update_location', 'Update Location')}
              </Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}