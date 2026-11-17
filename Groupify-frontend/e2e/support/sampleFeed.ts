// Signed-in group feed with sample data and no backend: every /api/v1 call
// is answered here. Shared by the feed e2e specs.
import type { Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const group = { _id: 'g1', name: 'Sample Group', description: '', createdBy: me, members: [me, friend], inviteCode: 'ABC123', createdAt: '2026-01-01T00:00:00.000Z' };
const share = (i: number) => ({
  _id: `sh${i}`, group: 'g1', sharedBy: i % 2 ? me : friend, spotifyTrackId: `t${i}`,
  trackName: `Sample Track ${i}`, artistName: 'Sample Artist', albumName: 'Sample Album',
  trackImage: null, trackPreviewUrl: null, trackExternalUrl: null, durationMs: 200000,
  genres: [], listeners: [], listenCount: 1, likes: [], likeCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

export async function openSampleFeed(page: Page, opts: { theme: 'light' | 'dark'; pendingInvite?: boolean }) {
  const invites = opts.pendingInvite
    ? [{ _id: 'i1', group: 'g1', invitedBy: me, invitedUser: { _id: 'u3', displayName: 'Invited Person', profileImage: null }, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' }]
    : [];
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
  }, [token, opts.theme]);
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    if (path.includes('/shares/groups/g1')) json = { success: true, shares: [1, 2, 3].map(share), total: 3, limit: 50, offset: 0 };
    else if (path.endsWith('/auth/me')) json = { success: true, user: me };
    else if (path.endsWith('/groups')) json = { success: true, groups: [group] };
    else if (path.endsWith('/groups/g1')) json = { success: true, group };
    else if (path.endsWith('/groups/g1/invites')) json = { success: true, invites };
    return route.fulfill({ json });
  });
  await page.goto('/groups/g1');
  await page.getByRole('heading', { name: 'Sample Group' }).waitFor();
}
