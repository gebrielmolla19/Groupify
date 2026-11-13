import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileScreen from './ProfileScreen';
import { getUserStats } from '../../../lib/api';

vi.mock('../../../contexts/UserContext', () => ({
  useUser: () => ({
    user: { displayName: 'Test User', email: 't@example.com', spotifyId: 'sp1' },
    logout: vi.fn(),
    fetchUser: vi.fn(),
  }),
}));
vi.mock('../../../lib/api', () => ({
  getUserStats: vi.fn().mockResolvedValue(null),
  updateUserProfile: vi.fn(),
}));
vi.mock('../../../lib/pushNotifications', () => ({
  requestPermissionAndSubscribe: vi.fn(),
  unsubscribePush: vi.fn(),
}));
vi.mock('./ThemeSwitch', () => ({ ThemeSwitch: () => null }));
vi.mock('./MoreLinks', () => ({ default: () => null }));

describe('ProfileScreen account actions', () => {
  it('has a single Sign Out button and points to Spotify for revoking access', async () => {
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getUserStats).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /disconnect spotify/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /apps in your spotify account settings/i })).toHaveAttribute(
      'href',
      'https://www.spotify.com/account/apps/',
    );
  });
});
