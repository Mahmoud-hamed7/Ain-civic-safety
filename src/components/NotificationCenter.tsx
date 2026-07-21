import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale'; // 👈 استدعاء اللغات للوقت
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import {
  Bell, Check, Trash2, FileText, Siren, Settings, X, BellOff,
} from 'lucide-react';
import { useNotificationStore, type NotificationItem } from '../store/notificationStore';

type FilterType = 'All' | 'Reports' | 'SOS' | 'System';

const FILTERS: FilterType[] = ['All', 'Reports', 'SOS', 'System'];

const TYPE_MAP: Record<string, { icon: React.ReactElement; color: string; tKey: string }> = {
  report: { icon: <FileText className="w-4 h-4" />, color: 'text-indigo-400 bg-indigo-400/10',  tKey: 'report' },
  sos:    { icon: <Siren    className="w-4 h-4" />, color: 'text-red-400    bg-red-400/10',      tKey: 'sos'    },
  system: { icon: <Settings className="w-4 h-4" />, color: 'text-gray-400   bg-gray-400/10',     tKey: 'system' },
};

function NotificationRow({ item, onRead, isRtl }: { item: NotificationItem; onRead: (id: string) => void, isRtl: boolean }) {
  const meta = TYPE_MAP[item.type] ?? TYPE_MAP.system;
  
  // تظبيط لغة الوقت (منذ يومين، منذ 5 دقائق، إلخ)
  const timeAgo = (() => {
    try { 
      return formatDistanceToNow(new Date(item.time), { 
        addSuffix: true,
        locale: isRtl ? ar : enUS 
      }); 
    }
    catch { return ''; }
  })();

  return (
    <button
      onClick={() => onRead(item.id)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-start transition-colors border-b border-gray-800/60 last:border-0 ${
        item.read ? 'hover:bg-gray-800/30' : 'bg-indigo-500/5 hover:bg-indigo-500/10'
      }`}
    >
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.color}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-tight truncate ${item.read ? 'text-gray-300' : 'text-white'}`}>
            {item.title}
          </p>
          {!item.read && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {item.description}
        </p>
        <p className="text-[10px] text-gray-600 mt-1" dir={isRtl ? 'rtl' : 'ltr'}>{timeAgo}</p>
      </div>
    </button>
  );
}

export default function NotificationCenter() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
  const [isOpen, setIsOpen]   = useState(false);
  const [filter, setFilter]   = useState<FilterType>('All');
  const panelRef              = useRef<HTMLDivElement>(null);

  const notifications = useNotificationStore((s) => s.notifications);
  const markRead      = useNotificationStore((s) => s.markRead);
  const markAllRead   = useNotificationStore((s) => s.markAllRead);
  const clearAll      = useNotificationStore((s) => s.clearAll);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = filter === 'All'
    ? notifications
    : notifications.filter((n) => n.type === filter.toLowerCase() as any);

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    else         document.removeEventListener('mousedown', handleOutsideClick);
    return ()  => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, handleOutsideClick]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={() => setIsOpen((o) => !o)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors outline-none"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-white' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-black text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        // 👈 التعديل الأهم هنا: شلنا right-0 وحطينا end-0 (أو ltr:right-0 rtl:left-0)
        // وكمان حطينا max-w-[calc(100vw-2rem)] عشان لو شاشة موبايل صغيرة متضربش
        <div className="absolute end-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-start"
          style={{ maxHeight: '440px' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">{t('notifications.title', 'Notifications')}</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
                  {unreadCount} {t('notifications.new', 'new')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                title={t('notifications.mark_all_read', 'Mark all read')}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed outline-none"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={clearAll}
                disabled={notifications.length === 0}
                title={t('notifications.clear_all', 'Clear all')}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed outline-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-800 bg-gray-900/80">
            {FILTERS.map((f) => {
              const count = f === 'All'
                ? notifications.filter((n) => !n.read).length
                : notifications.filter((n) => n.type === f.toLowerCase() && !n.read).length;
              
              // ترجمة الفلاتر
              const filterLabel = t(`notifications.filter_${f.toLowerCase()}`, f);

              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors outline-none ${
                    filter === f
                      ? 'bg-indigo-600/80 text-white'
                      : 'text-gray-500 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {filterLabel}
                  {count > 0 && (
                    <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/20 px-1 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <BellOff className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-sm font-semibold text-gray-500">{t('notifications.empty_title', 'No notifications')}</p>
                <p className="text-xs text-gray-700 mt-1">
                  {filter === 'All' 
                    ? t('notifications.empty_all', "You're all caught up!") 
                    : t('notifications.empty_filtered', 'No {{filter}} notifications.').replace('{{filter}}', t(`notifications.filter_${filter.toLowerCase()}`, filter))}
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <NotificationRow key={item.id} item={item} onRead={markRead} isRtl={isRtl} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-800 bg-gray-900/80 flex justify-between items-center">
              <p className="text-[10px] text-gray-600">{notifications.length} {t('notifications.total', 'total')}</p>
              <Link
                to="/admin/sos"
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                {t('notifications.sos_monitor', 'SOS Monitor')} {isRtl ? '←' : '→'}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}