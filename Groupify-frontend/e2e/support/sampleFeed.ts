// Signed-in group feed with sample data and no backend: every /api/v1 call
// is answered here. Shared by the feed e2e specs.
import { expect, type Page } from '@playwright/test';

const me = { _id: 'u1', spotifyId: 's1', displayName: 'Sample User', email: null, profileImage: null, groups: ['g1'], isActive: true };
const friend = { _id: 'u2', displayName: 'Test Friend', profileImage: null };
const other = { _id: 'u4', displayName: 'Other Member', profileImage: null };
const group = { _id: 'g1', name: 'Sample Group', description: '', createdBy: me, members: [me, friend, other], inviteCode: 'ABC123', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const second = { ...group, _id: 'g2', name: 'Second Group', inviteCode: 'DEF456' };
const at = '2026-01-01T00:00:00.000Z';
// Each listener heard it 4 minutes after the one before (timeToListen, ms).
const heard = (...users: object[]) => users.map((user, i) => ({ user, listenedAt: at, timeToListen: (i + 1) * 240_000 }));
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

// The "You" section of Group Dynamics for the sample user.
const youSummary = {
  range: '30d', role: { id: 'crowd_pleaser', title: 'Crowd Pleaser', reason: '2 of your 3 shares were listened to by everyone, the most in the group.' },
  previousRole: { id: 'sharer', title: 'Sharer' }, hitRate: { hits: 2, total: 3 }, streak: { longest: 2, record: 4 },
  bestShare: { shareId: 'sh3', trackName: 'Sample Track 3', artistName: 'Sample Artist', listens: 2, likes: 1, others: 2 },
  discovery: { artists: 1, resharedByOthers: 0 },
  reflex: { youPlayMs: 240_000, groupPlayMs: 480_000, yoursPlayedMs: 360_000, groupYoursPlayedMs: 300_000 },
};

// "Between you" for the sample user. The pair follows ?member=, so picking the
// other member in the screen shows a different verdict.
const betweenYou = (member: string | null) => {
  const pairs: Record<string, object> = {
    u2: { member: 'u2', theirShares: 4, youLiked: 3, yourShares: 5, theyLiked: 3, verdict: { id: 'closest_match' }, previousVerdict: { id: 'common_ground' } },
    u4: { member: 'u4', theirShares: 6, youLiked: 1, yourShares: 5, theyLiked: 3, verdict: { id: 'one_sided', leaning: 'them' }, previousVerdict: { id: 'too_early' } },
  };
  return {
    range: '30d',
    members: [other, friend].map(({ _id, displayName, profileImage }) => ({ userId: _id, displayName, profileImage })),
    pair: pairs[member ?? 'u2'],
    biggestFan: { members: ['u4'], listens: 4, likes: 3, yourShares: 5 },
    tastemaker: { members: ['u2'], liked: 3, shares: 4 },
  };
};

// Listener Reflex for the sample group, by mode ('received' is Listening,
// 'shared' is Sharing). Medians and buckets agree with each other.
const reflexMember = (u: { _id: string; displayName: string }, listens: number, medianMs: number | null, timing: number[]) => ({
  userId: u._id, displayName: u.displayName, avatarUrl: null, listens, medianMs, p25Ms: medianMs, p75Ms: medianMs,
  category: medianMs === null ? null : 'quick', listenRatio: listens / 6,
  timing: { sameHour: timing[0], sameDay: timing[1], withinWeek: timing[2], later: timing[3] },
});
const reflexAnswer = (mode: 'received' | 'shared') => {
  const users = mode === 'received'
    ? [reflexMember(me, 5, 240_000, [4, 1, 0, 0]), reflexMember(friend, 6, 9_000_000, [1, 3, 2, 0]), reflexMember(other, 3, 259_200_000, [0, 0, 2, 1])]
    : [reflexMember(me, 4, 360_000, [3, 1, 0, 0]), reflexMember(friend, 3, 86_400_000, [0, 1, 2, 0]), reflexMember(other, 0, null, [0, 0, 0, 0])];
  return {
    groupId: 'g1', range: '30d', mode, generatedAt: at, buckets: { instant: [], quick: [], slow: [], longTail: [] }, users,
    ringData: users.map((u) => ({ userId: u.userId, points: u.medianMs === null ? [] : Array.from({ length: u.listens }, (_, i) => ({ ms: u.medianMs, listenedAt: new Date(Date.parse(at) + i * 4 * 86_400_000).toISOString() })) })),
    summary: { groupMedianMs: users[1].medianMs, instantReactorCount: 1, totalSharesInRange: 6 },
  };
};

// `olderUnheard` makes the group bigger than the feed's first page: the feed
// reports that many more shares than it returns, and they are all unheard
// friend shares from 2025, served only by GET /shares/unheard?groupId=g1.
const olderShare = (i: number) => ({
  ...share(1), _id: `old${i}`, spotifyTrackId: `o${i}`, trackName: `Older Track ${i}`,
  sharedBy: friend, listeners: [], listenCount: 0, likes: [], likeCount: 0,
  group: { _id: 'g1', name: 'Sample Group' }, createdAt: `2025-0${i}-01T00:00:00.000Z`, updatedAt: at,
});

export async function openSampleFeed(page: Page, opts: { theme: 'light' | 'dark'; pendingInvite?: boolean; secondGroup?: boolean; olderUnheard?: number; olderUnheardFails?: boolean; tour?: boolean }) {
  const invites = opts.pendingInvite
    ? [{ _id: 'i1', group: 'g1', invitedBy: me, invitedUser: { _id: 'u3', displayName: 'Invited Person', profileImage: null }, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' }]
    : [];
  const token = 'x.' + Buffer.from(JSON.stringify({ id: 'u1', exp: 4102444800 })).toString('base64url') + '.y';
  await page.addInitScript(([t, theme, tour]) => {
    localStorage.setItem('groupify_token', t);
    localStorage.setItem('groupify-theme', theme);
    // The first-run tour covers the feed; skip it unless the spec is about it.
    if (!tour) localStorage.setItem('groupify_tour_completed', 'true');
  }, [token, opts.theme, opts.tour ?? false] as const);
  const shares = [1, 2, 3].map(share);
  const older = Array.from({ length: opts.olderUnheard ?? 0 }, (_, i) => olderShare(i + 1));
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: unknown = { success: true, groups: [], invites: [], notifications: [], devices: [] };
    const like = path.match(/\/shares\/(sh\d+)\/like$/);
    if (like) {
      // Toggle the sample user's like, as the backend does.
      const s = shares.find((x) => x._id === like[1])!;
      s.likes = s.likes.some((l) => l.user === me) ? s.likes.filter((l) => l.user !== me) : [...s.likes, { user: me, likedAt: at }];
      s.likeCount = s.likes.length;
      json = { success: true, share: s };
    } else if (path.includes('/shares/groups/g1')) json = { success: true, shares, total: shares.length + older.length, limit: 50, offset: 0 };
    else if (path.endsWith('/shares/unheard') && url.searchParams.get('groupId') === 'g1') {
      if (opts.olderUnheardFails) return route.fulfill({ status: 500, json: { success: false, message: 'Server error' } });
      // The group's unheard: share 2 from the first page, plus the older ones.
      const unheard = [shares[1], ...older];
      json = { success: true, shares: unheard, total: unheard.length, newThisWeek: 0, byGroup: { g1: unheard.length }, oldestAt: older.at(-1)?.createdAt ?? at };
    }
    else if (path.endsWith('/analytics/g1/you')) json = { success: true, data: youSummary };
    else if (path.endsWith('/analytics/g1/between')) json = { success: true, data: betweenYou(url.searchParams.get('member')) };
    else if (path.endsWith('/analytics/g1/listener-reflex')) json = { success: true, data: reflexAnswer(url.searchParams.get('mode') === 'shared' ? 'shared' : 'received') };
    else if (path.endsWith('/auth/me')) json = { success: true, user: me };
    else if (path.includes('/shares/groups/g2')) json = { success: true, shares: [], total: 0, limit: 50, offset: 0 };
    else if (path.endsWith('/groups')) json = { success: true, groups: opts.secondGroup ? [group, second] : [group] };
    else if (path.endsWith('/groups/g2')) json = { success: true, group: second };
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
