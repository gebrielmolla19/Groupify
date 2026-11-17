// Signed-in group feed with sample data and no backend: every /api/v1 call
// is answered here. Shared by the feed e2e specs.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const group = { _id: 'g1', name: 'Sample Group', description: '', createdBy: me, members: [me, friend, other], inviteCode: 'ABC123', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const at = '2026-01-01T00:00:00.000Z';
const heard = (...users: object[]) => users.map((user) => ({ user, listenedAt: at }));
// 1: shared by me, heard by one of two. 2: shared by a friend, unheard by me.
// 3: shared by me, heard by everyone, liked by me.
const variants = [
  { sharedBy: me, listeners: heard(friend), likes: [] as { user: object; likedAt: string }[] },
  { sharedBy: friend, listeners: heard(other), likes: [] },
  { sharedBy: me, listeners: heard(friend, other), likes: [{ user: me, likedAt: at }] },
];
const share = (i: number) => {
  const v = variants[(i - 1) % variants.length];
  return {
    _id: `sh${i}`, group: 'g1', sharedBy: v.sharedBy, spotifyTrackId: `t${i}`,
    trackName: `Sample Track ${i}`, artistName: 'Sample Artist', albumName: 'Sample Album',
    trackImage: null, trackPreviewUrl: null, trackExternalUrl: `https://open.spotify.com/track/t${i}`, durationMs: 200000,
    genres: [], listeners: v.listeners, listenCount: v.listeners.length, likes: v.likes, likeCount: v.likes.length,
    createdAt: at, updatedAt: at,
  };
};

export async function openSampleFeed(page: Page, opts: { theme: 'light' | 'dark'; pendingInvite?: boolean }) {
  const invites = opts.pendingInvite
    ? [{ _id: 'i1', group: 'g1', invitedBy: me, invitedUser: { _id: 'u3', displayName: 'Invited Person', profileImage: null }, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' }]
    : [];
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    // The first-run tour navigates to the dashboard; skip it.
    localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme]);
  const shares = [1, 2, 3].map(share);
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    const like = path.match(/\/shares\/(sh\d+)\/like$/);
    if (like) {
      // Toggle the sample user's like, as the backend does.
      const s = shares.find((x) => x._id === like[1])!;
      s.likes = s.likes.some((l) => l.user === me) ? s.likes.filter((l) => l.user !== me) : [...s.likes, { user: me, likedAt: at }];
      s.likeCount = s.likes.length;
      json = { success: true, share: s };
    } else if (path.includes('/shares/groups/g1')) json = { success: true, shares, total: shares.length, limit: 50, offset: 0 };
    else if (path.endsWith('/auth/me')) json = { success: true, user: me };
    else if (path.endsWith('/groups')) json = { success: true, groups: [group] };
    else if (path.endsWith('/groups/g1')) json = { success: true, group };
    else if (path.endsWith('/groups/g1/invites')) json = { success: true, invites };
    return route.fulfill({ json });
  });
  // Sign-in can settle on the dashboard first; go to the feed until it sticks.
  const search = page.getByPlaceholder(/Search and add a track/);
  await expect(async () => {
    if (new URL(page.url()).pathname !== '/groups/g1') await page.goto('/groups/g1');
    await expect(search).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}
