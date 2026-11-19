/**
 * Notifications Context
 * One list of the viewer's notifications for the whole app, so the rail's
 * Activity count, the phone tab bar and the Activity screen agree: marking
 * one read anywhere updates them all. Fetched once, kept current by socket.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppNotification, Group } from '../types';
import {
  getNotifications as apiGetNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
  getToken,
} from '../lib/api';
import { useSocket } from './SocketContext';
import { useUser } from './UserContext';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Why the last load failed, or null. */
  error: string | null;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  acceptInvite: (notification: AppNotification) => Promise<Group | null>;
  declineInvite: (notification: AppNotification) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useUser();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !getToken()) return;
    try {
      setLoading(true);
      setError(null);
      setNotifications(await apiGetNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
      logger.error('Failed to fetch notifications:', err);
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

  const removeNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n._id !== id));

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    try {
      await apiMarkRead(id);
    } catch (err) {
      // Optimistic: the item stays read here and comes back as new on the next load.
      logger.error('Failed to mark notification read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const wereNew = new Set(notifications.filter((n) => !n.read).map((n) => n._id));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiMarkAllRead();
    } catch (err) {
      // Don't claim "all caught up" when the server still has them as new.
      setNotifications((prev) => prev.map((n) => (wereNew.has(n._id) ? { ...n, read: false } : n)));
      toast.error("Couldn't mark everything read. Try again.");
      logger.error('Failed to mark all notifications read:', err);
    }
  }, [notifications]);

  const acceptInvite = useCallback(async (notification: AppNotification) => {
    const groupId = notification.group?._id;
    const inviteId = notification.metadata?.inviteId;
    if (!groupId || !inviteId) return null;
    try {
      const group = await apiAcceptInvite(groupId, inviteId);
      removeNotification(notification._id);
      await apiMarkRead(notification._id).catch((err) => logger.error('Failed to mark notification read:', err));
      toast.success(`Joined ${notification.metadata?.groupName || 'group'}!`);
      return group;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invite';
      toast.error(msg);
      return null;
    }
  }, []);

  const declineInvite = useCallback(async (notification: AppNotification) => {
    const groupId = notification.group?._id;
    const inviteId = notification.metadata?.inviteId;
    if (!groupId || !inviteId) return;
    try {
      await apiDeclineInvite(groupId, inviteId);
      removeNotification(notification._id);
      await apiMarkRead(notification._id).catch((err) => logger.error('Failed to mark notification read:', err));
      toast.success('Invite declined');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invite';
      toast.error(msg);
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, error, refetch: fetchNotifications, markRead, markAllRead, acceptInvite, declineInvite }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
