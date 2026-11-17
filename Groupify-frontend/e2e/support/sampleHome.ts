// Signed-in Home with sample data and no backend: every /api/v1 call is
// answered here. Shared by the Home e2e specs.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1', 'g2', 'g3'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const group = (id: string, name: string, members: object[], days: number) => ({
  _id: id, name, description: '', createdBy: me, members, inviteCode: `CODE${id.toUpperCase()}`, createdAt: ago(30), updatedAt: ago(days),
});
const groups = [
  group('g1', 'Sample Group', [me, friend, other], 2),
  group('g2', 'Second Group', [me, friend], 5),
  group('g3', 'Quiet Group', [me, other], 21),
];
// Unheard: two in Sample Group, one in Second Group; the oldest is 5 days old.
const unheard = [
  { n: 1, g: groups[0], by: friend, days: 1 },
  { n: 2, g: groups[1], by: other, days: 3 },
  { n: 3, g: groups[0], by: other, days: 5 },
].map(({ n, g, by, days }) => ({
  _id: `sh${n}`, group: { _id: g._id, name: g.name }, sharedBy: by, spotifyTrackId: `t${n}`,
  trackName: `Waiting Track ${n}`, artistName: 'Sample Artist', albumName: 'Sample Album',
  trackImage: null, trackPreviewUrl: null, trackExternalUrl: `https://open.spotify.com/track/t${n}`, durationMs: 200000,
  genres: [], listeners: [], listenCount: 0, likes: [], likeCount: 0, createdAt: ago(days), updatedAt: ago(days),
}));

export async function openSampleHome(page: Page, opts: { theme: 'light' | 'dark'; caughtUp?: boolean; noGroups?: boolean; unheardFails?: boolean }) {
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme]);
  const shares = opts.caughtUp || opts.noGroups ? [] : unheard;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    if (path.endsWith('/shares/unheard') && opts.unheardFails) {
      return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } });
    } else if (path.endsWith('/shares/unheard')) {
      json = {
        success: true, shares, total: shares.length,
        byGroup: shares.length ? { g1: 2, g2: 1 } : {},
        oldestAt: shares.length ? ago(5) : null,
      };
    } else if (path.endsWith('/auth/me')) json = { success: true, user: me };
    else if (path.endsWith('/groups')) json = { success: true, groups: opts.noGroups ? [] : groups };
    else if (path.includes('/shares/groups/')) json = { success: true, shares: [], total: 0, limit: 50, offset: 0 };
    return route.fulfill({ json });
  });
  await expect(async () => {
    if (new URL(page.url()).pathname !== '/') await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}
