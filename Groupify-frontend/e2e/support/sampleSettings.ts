// Signed-in app on Profile or Group settings with sample data and no backend:
// every /api/v1 call is answered here. Shared by the settings e2e specs.
import { expect, type Page } from '@playwright/test';

const me = {
  _id: 'u1', spotifyId: 'sample.user', displayName: 'Sample User', email: 'sample@example.com', profileImage: null, groups: ['g1', 'g2'], isActive: true,
  notificationPreferences: { song_shared: true, group_invite: false, member_joined: true },
};
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const group = (id: string, name: string, owner: object) => ({
  _id: id, name, description: 'Sample description', createdBy: owner, members: [me, friend, other],
  inviteCode: `SAMPLE${id.toUpperCase()}CODE0000`.slice(0, 16), createdAt: ago(30), updatedAt: ago(2),
});
// g1 is owned by the signed-in user; in g2 they are a member.
const groups = [group('g1', 'Sample Group', me), group('g2', 'Second Group', friend)];
const settingsOf = (g: (typeof groups)[number]) => ({
  name: g.name, description: g.description,
  members: g.members.map((m) => ({ id: m._id, displayName: m.displayName, profileImage: null })),
});

/** The returned `requests` lists every non-GET call, as `METHOD /path`. */
export async function openSampleSettings(page: Page, opts: { theme: 'light' | 'dark'; path: string }) {
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme]);
  const requests: string[] = [];
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    if (req.method() !== 'GET') requests.push(`${req.method()} ${path}`);
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    const settings = path.match(/^\/groups\/(g\d)\/settings$/);
    if (path === '/auth/me') json = { success: true, user: me };
    else if (path === '/users/stats') json = { success: true, stats: { tracksShared: 12, groupsJoined: 2, totalListens: 48 } };
    else if (path === '/groups') json = { success: true, groups };
    else if (settings) json = { success: true, data: settingsOf(groups.find((g) => g._id === settings[1])!) };
    else if (/^\/groups\/g\d$/.test(path)) json = { success: true, group: groups.find((g) => path.endsWith(g._id)) };
    else if (path.startsWith('/shares/groups/')) json = { success: true, shares: [], total: 0, limit: 50, offset: 0 };
    else if (path === '/shares/unheard') json = { success: true, shares: [], total: 0, newThisWeek: 0, byGroup: {}, oldestAt: null };
    return route.fulfill({ json });
  });
  await expect(async () => {
    if (new URL(page.url()).pathname !== opts.path) await page.goto(opts.path);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  return { requests };
}
