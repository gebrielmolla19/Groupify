/**
 * useNotifications hook
 * Delegates to NotificationsContext so the rail, the tab bar and the
 * Activity screen share one list. The logic lives in NotificationsContext.tsx.
 */
import { useNotificationsContext } from '../contexts/NotificationsContext';

export const useNotifications = () => useNotificationsContext();
