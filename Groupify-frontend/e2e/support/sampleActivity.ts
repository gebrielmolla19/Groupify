// Signed-in app with sample activity and no backend: every /api/v1 call is
// answered here. Shared by the Activity e2e specs.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1', 'g2'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const hour = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * hour).toISOString();
// "Today" is the calendar day, so today's items must fall after midnight even
// when the suite runs just after it.
const sinceMidnight = () => (Date.now() - new Date().setHours(0, 0, 0, 0)) / hour;
const today = (hours: number) => Math.min(hours, sinceMidnight() * hours / 4);
const group = (id: string, name: string) => ({
  _id: id, name, description: '', createdBy: me, members: [me, friend, other], inviteCode: `CODE${id.toUpperCase()}`, createdAt: ago(900), updatedAt: ago(24),
});
const groups = [group('g1', 'Sample Group'), group('g2', 'Second Group')];
const ref = (g: { _id: string; name: string }) => ({ _id: g._id, name: g.name });

// Three unread (an invite, a share, a member joining), then two read ones:
// one from this week and one from three weeks ago.
const notifications = () => [
  { _id: 'n1', type: 'group_invite', group: { _id: 'g3', name: 'Invite Group' }, actor: friend, metadata: { groupName: 'Invite Group', inviteId: 'i1' }, read: false, createdAt: ago(today(2)) },
  { _id: 'n2', type: 'song_shared', group: ref(groups[0]), actor: friend, metadata: { trackName: 'Sample Track A', artistName: 'Sample Artist', groupName: 'Sample Group' }, read: false, createdAt: ago(today(3)) },
  { _id: 'n3', type: 'member_joined', group: ref(groups[0]), actor: other, metadata: { memberName: 'Other Member', groupName: 'Sample Group' }, read: false, createdAt: ago(26) },
  { _id: 'n4', type: 'song_shared', group: ref(groups[1]), actor: other, metadata: { trackName: 'Sample Track B', artistName: 'Sample Artist', groupName: 'Second Group' }, read: true, createdAt: ago(72) },
  { _id: 'n5', type: 'song_shared', group: ref(groups[0]), actor: friend, metadata: { trackName: 'Sample Track C', artistName: 'Sample Artist', groupName: 'Sample Group' }, read: true, createdAt: ago(500) },
];

/**
 * `empty`: no activity at all. `fails`: GET /notifications answers 500 until
 * the returned `recover()` is called. `path`: the screen to open.
 * The returned `requests` lists every non-GET call, as `METHOD /path`.
 */
export async function openSampleActivity(page: Page, opts: { theme: 'light' | 'dark'; path?: string; empty?: boolean; fails?: boolean }) {
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme]);
  let failing = opts.fails ?? false;
  const list = opts.empty ? [] : notifications();
  const requests: string[] = [];
  let accepted = false;
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    if (req.method() !== 'GET') requests.push(`${req.method()} ${path}`);
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    if (path === '/notifications' && failing) return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } });
    if (path === '/notifications') json = { success: true, notifications: list };
    else if (path === '/auth/me') json = { success: true, user: me };
    else if (path === '/groups') json = { success: true, groups: accepted ? [...groups, group('g3', 'Invite Group')] : groups };
    else if (/^\/groups\/g\d$/.test(path)) json = { success: true, group: [...groups, group('g3', 'Invite Group')].find((g) => path.endsWith(g._id)) };
    else if (path.startsWith('/shares/groups/')) json = { success: true, shares: [], total: 0, limit: 50, offset: 0 };
    else if (path === '/shares/unheard') json = { success: true, shares: [], total: 0, newThisWeek: 0, byGroup: {}, oldestAt: null };
    else if (path === '/groups/g3/invite/i1/accept') {
      accepted = true;
      json = { success: true, group: group('g3', 'Invite Group') };
    }
    return route.fulfill({ json });
  });
  const target = opts.path ?? '/activity';
  await expect(async () => {
    if (new URL(page.url()).pathname !== target) await page.goto(target);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  return { requests, recover: () => { failing = false; } };
}
