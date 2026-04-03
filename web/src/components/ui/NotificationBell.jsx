/**
 * NotificationBell — Cittaa Health Services · Vocalysis Platform
 *
 * Real-time bell icon with unread badge, dropdown panel, and mark-read actions.
 * Connects to the SSE stream via the useNotifications hook.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, CheckCheck, X, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const TYPE_CONFIG = {
  alert:             { icon: '⚠️', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  pre_alert:         { icon: '🔔', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-100' },
  session_complete:  { icon: '✅', color: 'text-green-600',  bg: 'bg-green-50  border-green-100'  },
  approval:          { icon: '✅', color: 'text-green-600',  bg: 'bg-green-50  border-green-100'  },
  rejection:         { icon: '❌', color: 'text-red-600',    bg: 'bg-red-50    border-red-100'    },
  nudge:             { icon: '💡', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
  consultation_soon: { icon: '🗓️', color: 'text-teal-600',  bg: 'bg-teal-50   border-teal-100'   },
  report_ready:      { icon: '📄', color: 'text-blue-600',   bg: 'bg-blue-50   border-blue-100'   },
  weekly_summary:    { icon: '📊', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, connected, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleOpen() {
    setOpen(o => !o);
  }

  function handleNotifClick(notif) {
    if (!notif.read) markRead(notif._id);
    const url = notif.payload?.actionUrl;
    if (url) window.location.href = url;
  }

  const cfg = (type) => TYPE_CONFIG[type] || { icon: '🔔', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {unreadCount > 0
          ? <BellRing className="w-5 h-5 text-purple-700 animate-[wiggle_0.5s_ease-in-out]" />
          : <Bell className="w-5 h-5 text-gray-500" />
        }
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center
                           rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* Connection indicator dot */}
        <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[520px] rounded-2xl shadow-2xl border border-purple-100 bg-white overflow-hidden z-50 flex flex-col"
             style={{ boxShadow: '0 8px 40px rgba(109,40,217,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-purple-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-700" />
              <span className="text-sm font-700 text-purple-900 font-semibold">Notifications</span>
              {!connected && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <WifiOff className="w-3 h-3" /> reconnecting…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              notifications.map(notif => {
                const c = cfg(notif.type);
                return (
                  <div
                    key={notif._id}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-purple-50/40 transition-colors
                                ${notif.read ? 'opacity-60' : ''}`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1">
                      {!notif.read && (
                        <span className="block w-2 h-2 rounded-full bg-purple-500 mt-0.5" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-semibold ${c.color} leading-snug`}>
                          {c.icon} {notif.title}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      {notif.body && (
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug line-clamp-2">{notif.body}</p>
                      )}
                      {notif.payload?.actionUrl && (
                        <span className="text-[10px] text-purple-500 flex items-center gap-0.5 mt-1">
                          <ExternalLink className="w-3 h-3" /> View details
                        </span>
                      )}
                    </div>
                    {/* Dismiss */}
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(notif._id); }}
                      className="flex-shrink-0 text-gray-300 hover:text-gray-500 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-purple-50 bg-purple-50/30 text-center">
            <a href="/notifications" className="text-xs text-purple-600 hover:text-purple-800 font-medium">
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
