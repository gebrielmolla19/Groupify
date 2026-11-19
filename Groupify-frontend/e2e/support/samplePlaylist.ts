// Signed-in group playlist with sample data and no backend: every /api/v1
// call is answered here. Shared by the playlist e2e specs.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const at = (day: number) => `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`;
const listens = (...users: object[]) => users.map((user) => ({ user, listenedAt: at(20), timeToListen: 240_000 }));

// Six shares: track n was shared on day n, so "Newest" is 6..1. Listens
// make "Most listened" 3, 1, 5, then the rest newest first.
const tracks = [
  { by: me, listeners: listens(friend, other), mins: 3 },
  { by: friend, listeners: [], mins: 4 },
  { by: other, listeners: listens(me, friend, other), mins: 5 },
  { by: friend, listeners: [], mins: 2 },
  { by: me, listeners: listens(friend), mins: 6 },
  { by: other, listeners: [], mins: 4 },
];
const share = (t: (typeof tracks)[number], i: number) => ({
  _id: `sh${i + 1}`, group: 'g1', sharedBy: t.by, spotifyTrackId: `t${i + 1}`,
  trackName: `Playlist Track ${i + 1}`, artistName: `Sample Artist ${i + 1}`, albumName: 'Sample Album',
  trackImage: null, trackPreviewUrl: null, trackExternalUrl: `https://open.spotify.com/track/t${i + 1}`,
  durationMs: t.mins * 60_000, genres: [], listeners: t.listeners, listenCount: t.listeners.length,
  likes: [], likeCount: 0, createdAt: at(i + 1), updatedAt: at(i + 1),
});

/**
 * `spotify`: whether the group's playlist is already on Spotify, and on whose
 * account ('mine' = the sample user's, 'theirs' = another member's).
 * `fails`: playlist loads answer 500 until the returned `recover()` is called.
 * (The player card loads the viewed group's playlist too, so a fixed count
 * of failures would be racy.)
 */
export async function openSamplePlaylist(page: Page, opts: { theme: 'light' | 'dark'; empty?: boolean; fails?: boolean; spotify?: 'mine' | 'theirs' }) {
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme]);
  const group = {
    _id: 'g1', name: 'Sample Group', description: '', createdBy: me, members: [me, friend, other], inviteCode: 'ABC123',
    createdAt: at(1), updatedAt: at(1),
    ...(opts.spotify && {
      spotifyPlaylistId: 'p1', spotifyPlaylistUrl: 'https://open.spotify.com/playlist/p1',
      spotifyPlaylistOwnerId: opts.spotify === 'mine' ? 'u1' : 'u2',
    }),
  };
  const shares = opts.empty ? [] : tracks.map(share);
  let failing = opts.fails ?? false;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    if (path.includes('/shares/groups/g1') && failing) {
      return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } });
    } else if (path.includes('/shares/groups/g1')) json = { success: true, shares, total: shares.length, limit: 100, offset: 0 };
    else if (path.endsWith('/auth/me')) json = { success: true, user: me };
    else if (path.endsWith('/groups')) json = { success: true, groups: [group] };
    else if (path.endsWith('/groups/g1')) json = { success: true, group };
    return route.fulfill({ json });
  });
  // Sign-in can settle on Home first; go to the playlist until it sticks.
  await expect(async () => {
    if (new URL(page.url()).pathname !== '/groups/g1/playlist') await page.goto('/groups/g1/playlist');
    await expect(page.getByRole('button', { name: /Back to group feed/ })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  return { recover: () => { failing = false; } };
}
