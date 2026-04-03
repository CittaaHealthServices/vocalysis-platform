/**
 * useNotifications — Vocalysis Platform
 *
 * React hook that opens a Server-Sent Events (SSE) connection to
 * /notifications/stream and delivers real-time in-app notifications.
 *
 * Features:
 *   ✦ Auto-reconnect with exponential back-off (max 30s)
 *   ✦ Unread badge count via /notifications/unread-count
 *   ✦ Local state for notification list (up to 50 most recent)
 *   ✦ mark-read, mark-all-read, dismiss helpers
 *
 * Usage:
 *   const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_NOTIFICATIONS = 50;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 30_000;

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount,   setUnreadCount]     = useState(0);
  const [connected,     setConnected]       = useState(false);
  const esRef           = useRef(null);
  const reconnectTimer  = useRef(null);
  const reconnectDelay  = useRef(RECONNECT_BASE_MS);
  const mountedRef      = useRef(true);

  // ── Fetch initial unread count & recent notifications via REST ──────────────
  const fetchInitial = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=50`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data || []);
        setUnreadCount(json.meta?.unreadCount ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Open SSE connection ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!isAuthenticated || !mountedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`${API_BASE}/notifications/stream`, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      reconnectDelay.current = RECONNECT_BASE_MS;
    });

    // Generic handler for all named event types
    const NOTIFICATION_EVENTS = [
      'alert', 'pre_alert', 'session_complete', 'approval', 'rejection',
      'nudge', 'consultation_soon', 'report_ready', 'weekly_summary',
      'b2c_registration', 'system',
    ];

    NOTIFICATION_EVENTS.forEach(eventType => {
      es.addEventListener(eventType, (e) => {
        try {
          const data = JSON.parse(e.data);
          const notif = {
            _id:       data.notificationId || `tmp-${Date.now()}`,
            type:      eventType,
            title:     data.title || _defaultTitle(eventType),
            body:      data.body  || data.message || '',
            payload:   data,
            read:      false,
            createdAt: new Date().toISOString(),
          };
          setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
          setUnreadCount(c => c + 1);
          // Optional: browser native notification
          _tryBrowserNotification(notif);
        } catch { /* malformed data */ }
      });
    });

    // Bulk delivery of pending notifications when reconnecting
    es.addEventListener('pending_notifications', (e) => {
      try {
        const { notifications: pending } = JSON.parse(e.data);
        if (pending?.length) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n._id?.toString()));
            const newOnes = pending.filter(n => !existingIds.has(n._id?.toString()));
            return [...newOnes, ...prev].slice(0, MAX_NOTIFICATIONS);
          });
          setUnreadCount(c => c + pending.filter(n => !n.read).length);
        }
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, RECONNECT_MAX_MS);
          connect();
        }, reconnectDelay.current);
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    if (isAuthenticated) {
      fetchInitial();
      connect();
    }
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, [isAuthenticated, connect, fetchInitial]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const markRead = useCallback(async (id) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      setNotifications(prev =>
        prev.map(n => n._id?.toString() === id?.toString() ? { ...n, read: true } : n)
      );
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  const dismiss = useCallback(async (id) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setNotifications(prev => {
        const notif = prev.find(n => n._id?.toString() === id?.toString());
        if (notif && !notif.read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n._id?.toString() !== id?.toString());
      });
    } catch { /* ignore */ }
  }, []);

  return { notifications, unreadCount, connected, markRead, markAllRead, dismiss };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _defaultTitle(type) {
  const t = {
    alert:             '⚠️ Wellbeing Alert',
    pre_alert:         '🔔 Trend Notice',
    session_complete:  '✅ Check-in Complete',
    approval:          '✅ Account Approved',
    rejection:         '❌ Account Update',
    nudge:             '💡 Coaching Insight',
    consultation_soon: '🗓️ Upcoming Session',
    report_ready:      '📄 Report Ready',
    weekly_summary:    '📊 Weekly Summary',
  };
  return t[type] || '🔔 Notification';
}

function _tryBrowserNotification(notif) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body, icon: '/favicon.ico' });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch { /* Safari / privacy mode */ }
}
