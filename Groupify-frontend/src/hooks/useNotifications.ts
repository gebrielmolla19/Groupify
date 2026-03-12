import { useState, useEffect, useCallback } from 'react';
import { AppNotification } from '../types';
import {
  getNotifications as apiGetNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  getToken,
} from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { useUser } from '../contexts/UserContext';

export function useNotifications() {
  const { isAuthenticated } = useUser();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !getToken()) return;
    try {
      setLoading(true);
      const data = await apiGetNotifications();
      setNotifications(data);
    } catch {
      // silently fail — non-critical
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Clear on logout
  useEffect(() => {
    if (!isAuthenticated) setNotifications([]);
  }, [isAuthenticated]);

  // Real-time: prepend new notification from socket
  useEffect(() => {
    if (!socket) return;
    const handler = (notification: AppNotification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 30));
    };
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, [socket]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    try {
      await apiMarkRead(id);
    } catch {
      // optimistic update — silently fail
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiMarkAllRead();
    } catch {
      // silently fail
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markRead, markAllRead };
}
