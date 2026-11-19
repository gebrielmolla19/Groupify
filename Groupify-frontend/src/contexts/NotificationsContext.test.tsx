import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { NotificationsProvider } from './NotificationsContext';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../types';

vi.mock('../lib/api', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(() => Promise.resolve()),
  markAllNotificationsRead: vi.fn(() => Promise.resolve()),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  getToken: vi.fn(() => 'jwt'),
}));
vi.mock('./UserContext', () => ({ useUser: () => ({ isAuthenticated: true }) }));
vi.mock('./SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('../utils/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { getNotifications, markAllNotificationsRead, markNotificationRead } = await import('../lib/api');
const { logger } = await import('../utils/logger');
const { toast } = await import('sonner');

const note = (id: string, read = false) => ({
  _id: id, type: 'member_joined', group: { _id: 'g1', name: 'Sample Group' }, actor: { _id: 'u2', displayName: 'Test Friend' },
  metadata: {}, read, createdAt: '2026-01-01T00:00:00.000Z',
}) as AppNotification;

const wrapper = ({ children }: { children: ReactNode }) => <NotificationsProvider>{children}</NotificationsProvider>;

describe('NotificationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotifications).mockReset();
  });

  it('reports a failed load and loads again on refetch', async () => {
    vi.mocked(getNotifications).mockRejectedValueOnce(new Error('Server error')).mockResolvedValueOnce([note('n1')]);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.loading).toBe(false);

    await act(() => result.current.refetch());

    expect(result.current.error).toBe(null);
    expect(result.current.notifications.map((n) => n._id)).toEqual(['n1']);
  });

  it('shares one state: marking read in one consumer updates the unread count in another', async () => {
    vi.mocked(getNotifications).mockResolvedValue([note('n1'), note('n2'), note('n3', true)]);
    const { result } = renderHook(() => ({ screen: useNotifications(), badge: useNotifications() }), { wrapper });
    await waitFor(() => expect(result.current.badge.unreadCount).toBe(2));

    await act(() => result.current.screen.markRead('n1'));

    expect(result.current.badge.unreadCount).toBe(1);
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it('a failed mark-all-read puts the new items back, says so once and logs it', async () => {
    vi.mocked(getNotifications).mockResolvedValue([note('n1'), note('n2'), note('n3', true)]);
    vi.mocked(markAllNotificationsRead).mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(() => result.current.markAllRead());

    expect(result.current.unreadCount).toBe(2);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('a failed mark-read is logged', async () => {
    vi.mocked(getNotifications).mockResolvedValue([note('n1')]);
    vi.mocked(markNotificationRead).mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(() => result.current.markRead('n1'));

    expect(logger.error).toHaveBeenCalledWith('Failed to mark notification read:', expect.any(Error));
  });
});
