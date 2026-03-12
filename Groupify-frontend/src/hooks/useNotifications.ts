import { useState, useEffect, useCallback } from 'react';
import { AppNotification } from '../types';
import {
  getNotifications as apiGetNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
  getToken,
} from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';

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

  const removeNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n._id !== id));

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

  const acceptInvite = useCallback(async (notification: AppNotification) => {
    const groupId = notification.group?._id;
    const inviteId = notification.metadata?.inviteId;
    if (!groupId || !inviteId) return null;
    try {
      const group = await apiAcceptInvite(groupId, inviteId);
      removeNotification(notification._id);
      await apiMarkRead(notification._id).catch(() => {});
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
      await apiMarkRead(notification._id).catch(() => {});
      toast.success('Invite declined');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invite';
      toast.error(msg);
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markRead, markAllRead, acceptInvite, declineInvite };
}
