const mongoose = require('mongoose');
const Share = require('../models/Share');

/**
 * The "You" section of Group Dynamics (#56): numbers about one member, the
 * viewer, in one group over one period.
 *
 * `summarizeViewer` is pure: it takes every share the group has ever had and
 * works everything out from fields Share already stores. `getViewerSummary`
 * loads those shares and calls it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { '7d': 7, '30d': 30 };
const VIEWER_SUMMARY_RANGES = ['7d', '30d', 'all'];

// A member needs this much in the period before a role can be about them.
const MIN_SHARES_FOR_RATE_ROLES = 3;
const MIN_ARTISTS_FOR_PATIENT_ZERO = 2;
const MIN_STREAK_FOR_REGULAR = 3;
const MIN_LISTENS_FOR_FRONT_ROW = 3;

const ROLE_TITLES = {
  tastemaker: 'Tastemaker',
  crowd_pleaser: 'Crowd Pleaser',
  patient_zero: 'Patient Zero',
  regular: 'The Regular',
  front_row: 'Front Row',
  sharer: 'Sharer',
  listener: 'Listener',
  quiet: 'Quiet'
};

const id = (value) => (value == null ? null : value.toString());
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** "2026-11-19" in the given time zone. */
function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/** Longest run of consecutive calendar days among the given dates. */
function longestDayRun(dates, timeZone) {
  const days = [...new Set(dates.map((d) => dayKey(d, timeZone)))]
    .map((key) => Date.parse(`${key}T00:00:00Z`) / DAY_MS)
    .sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

function windowFor(range, now, offsetPeriods = 0) {
  const days = RANGE_DAYS[range];
  if (!days) return { start: null, end: null };
  const end = new Date(now.getTime() - offsetPeriods * days * DAY_MS);
  return { start: new Date(end.getTime() - days * DAY_MS), end };
}

function inWindow(date, { start, end }) {
  const t = new Date(date).getTime();
  return (start === null || t >= start.getTime()) && (end === null || t < end.getTime());
}

/**
 * The first member to share each artist in the group, ever. Artists are the
 * stored artistName string, compared without case: splitting it on ", "
 * would break names like "Tyler, The Creator".
 */
function firstSharers(sortedShares) {
  const first = new Map();
  for (const share of sortedShares) {
    const artist = share.artistName.trim().toLowerCase();
    if (!first.has(artist)) first.set(artist, { by: id(share.sharedBy), at: share.createdAt });
  }
  return first;
}

/** Per-member numbers for one window, used for the role. */
function memberStats(sortedShares, members, window, timeZone, firstByArtist) {
  const stats = new Map(members.map((m) => [m, {
    shares: 0,
    likesReceived: 0,
    hits: 0,
    discovered: 0,
    shareDates: [],
    listensGiven: 0
  }]));
  let othersShares = 0;

  for (const share of sortedShares) {
    if (!inWindow(share.createdAt, window)) continue;
    const sharer = id(share.sharedBy);
    const mine = stats.get(sharer);
    // A former member's shares stay in the group but count for no one, so
    // Front Row's listens and the shares they're out of are the same set.
    if (!mine) continue;
    const listeners = new Set(share.listeners.map((l) => id(l.user)));
    for (const [member, s] of stats) {
      if (member !== sharer && listeners.has(member)) s.listensGiven += 1;
    }
    othersShares += 1;
    mine.shares += 1;
    mine.shareDates.push(share.createdAt);
    mine.likesReceived += share.likes.filter((l) => id(l.user) !== sharer && stats.has(id(l.user))).length;
    const others = members.filter((m) => m !== sharer);
    if (others.length > 0 && others.every((m) => listeners.has(m))) mine.hits += 1;
  }

  for (const { by, at } of firstByArtist.values()) {
    if (stats.has(by) && inWindow(at, window)) stats.get(by).discovered += 1;
  }
  for (const s of stats.values()) {
    s.longestStreak = longestDayRun(s.shareDates, timeZone);
    s.othersSharesCount = othersShares - s.shares;
  }
  return stats;
}

/** True when the viewer's value is above zero and nobody eligible beats it. */
function leads(stats, viewerId, value, eligible) {
  const mine = stats.get(viewerId);
  if (!eligible(mine) || value(mine) <= 0) return false;
  for (const [member, s] of stats) {
    if (member !== viewerId && eligible(s) && value(s) > value(mine)) return false;
  }
  return true;
}

const ROLE_RULES = [
  {
    id: 'tastemaker',
    eligible: (s) => s.shares >= MIN_SHARES_FOR_RATE_ROLES,
    value: (s) => s.likesReceived / s.shares,
    reason: (s) => `No one's shares get liked more often than yours: ${plural(s.likesReceived, 'like')} across ${plural(s.shares, 'share')}.`
  },
  {
    id: 'crowd_pleaser',
    eligible: (s) => s.shares >= MIN_SHARES_FOR_RATE_ROLES,
    value: (s) => s.hits / s.shares,
    reason: (s) => `No one gets more of their shares listened to by the whole group: ${s.hits} of your ${s.shares}.`
  },
  {
    id: 'patient_zero',
    eligible: (s) => s.discovered >= MIN_ARTISTS_FOR_PATIENT_ZERO,
    value: (s) => s.discovered,
    reason: (s) => `You brought ${plural(s.discovered, 'artist')} to the group before anyone else did.`
  },
  {
    id: 'regular',
    eligible: (s) => s.longestStreak >= MIN_STREAK_FOR_REGULAR,
    value: (s) => s.longestStreak,
    reason: (s) => `You shared ${s.longestStreak} days in a row, and no one in the group did more.`
  },
  {
    id: 'front_row',
    eligible: (s) => s.listensGiven >= MIN_LISTENS_FOR_FRONT_ROW,
    value: (s) => s.listensGiven,
    reason: (s) => `No one listened to more of the group's shares: you heard ${s.listensGiven} of the ${s.othersSharesCount} others made.`
  }
];

function roleFor(stats, viewerId) {
  const mine = stats.get(viewerId);
  for (const rule of ROLE_RULES) {
    if (leads(stats, viewerId, rule.value, rule.eligible)) {
      return { id: rule.id, title: ROLE_TITLES[rule.id], reason: rule.reason(mine) };
    }
  }
  if (mine.shares > 0) {
    return {
      id: 'sharer',
      title: ROLE_TITLES.sharer,
      reason: `You made ${plural(mine.shares, 'share')}. A role needs a few more shares or listens to settle.`
    };
  }
  if (mine.listensGiven > 0) {
    return {
      id: 'listener',
      title: ROLE_TITLES.listener,
      reason: `You listened to ${plural(mine.listensGiven, 'share')} from others, and haven't shared one in this period yet.`
    };
  }
  return { id: 'quiet', title: ROLE_TITLES.quiet, reason: 'No shares or listens from you in this period yet.' };
}

/**
 * How fast listens happen, as medians in ms:
 * - youPlayMs: the viewer playing other members' shares
 * - groupPlayMs: the typical member doing the same (median of members' medians)
 * - yoursPlayedMs: other members playing the viewer's shares
 * - groupYoursPlayedMs: the typical sharer's shares being played
 */
function reflexFor(shares, members, viewerId, window) {
  const playTimes = new Map(members.map((m) => [m, []]));
  const playedTimes = new Map(members.map((m) => [m, []]));
  for (const share of shares) {
    if (!inWindow(share.createdAt, window)) continue;
    const sharer = id(share.sharedBy);
    for (const listen of share.listeners) {
      const listener = id(listen.user);
      if (listener === sharer || listen.timeToListen == null || !playTimes.has(listener)) continue;
      playTimes.get(listener).push(listen.timeToListen);
      if (playedTimes.has(sharer)) playedTimes.get(sharer).push(listen.timeToListen);
    }
  }
  const medians = (map) => [...map.values()].map(median).filter((m) => m !== null);
  return {
    youPlayMs: median(playTimes.get(viewerId)),
    groupPlayMs: median(medians(playTimes)),
    yoursPlayedMs: median(playedTimes.get(viewerId)),
    groupYoursPlayedMs: median(medians(playedTimes))
  };
}

/**
 * @param {Object} args
 * @param {Array} args.shares - every share in the group, any order
 * @param {Array} args.memberIds - the group's current members
 * @param {string} args.viewerId
 * @param {'7d'|'30d'|'all'} args.range
 * @param {Date} args.now
 * @param {string} args.timeZone - IANA zone for counting calendar days
 */
function summarizeViewer({ shares, memberIds, viewerId, range, now, timeZone }) {
  const members = memberIds.map(id);
  const viewer = id(viewerId);
  const sorted = [...shares].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const window = windowFor(range, now);
  const firstByArtist = firstSharers(sorted);

  const stats = memberStats(sorted, members, window, timeZone, firstByArtist);
  const mine = stats.get(viewer);
  const myShares = sorted.filter((s) => id(s.sharedBy) === viewer && inWindow(s.createdAt, window));
  const others = members.filter((m) => m !== viewer);

  let bestShare = null;
  let bestScore = 0;
  for (const share of myShares) {
    const listens = share.listeners.filter((l) => others.includes(id(l.user))).length;
    const likes = share.likes.filter((l) => others.includes(id(l.user))).length;
    // Later shares win ties, so the card shows the most recent of equals.
    if (listens + likes > 0 && listens + likes >= bestScore) {
      bestScore = listens + likes;
      bestShare = {
        shareId: id(share._id),
        trackName: share.trackName,
        artistName: share.artistName,
        listens,
        likes,
        others: others.length
      };
    }
  }

  let resharedByOthers = 0;
  for (const [artist, { by, at }] of firstByArtist) {
    if (by !== viewer || !inWindow(at, window)) continue;
    const reshared = sorted.some((s) => id(s.sharedBy) !== viewer
      && s.artistName.trim().toLowerCase() === artist);
    if (reshared) resharedByOthers += 1;
  }

  let previousRole = null;
  if (RANGE_DAYS[range]) {
    const previous = memberStats(sorted, members, windowFor(range, now, 1), timeZone, firstByArtist);
    const { id: roleId, title } = roleFor(previous, viewer);
    previousRole = { id: roleId, title };
  }

  return {
    range,
    role: roleFor(stats, viewer),
    previousRole,
    hitRate: others.length > 0 ? { hits: mine.hits, total: mine.shares } : null,
    streak: {
      longest: mine.longestStreak,
      record: longestDayRun(sorted.filter((s) => id(s.sharedBy) === viewer).map((s) => s.createdAt), timeZone)
    },
    bestShare,
    discovery: { artists: mine.discovered, resharedByOthers },
    reflex: reflexFor(sorted, members, viewer, window)
  };
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the group's shares and summarize them for the viewer.
 * The caller has already checked that the viewer is a member and passes the
 * group's member ids (isGroupMember loaded the group).
 */
async function getViewerSummary(groupId, memberIds, viewerId, range, timeZone, now = new Date()) {
  const shares = await Share.find({ group: new mongoose.Types.ObjectId(groupId) })
    .select('sharedBy trackName artistName createdAt listeners.user listeners.timeToListen likes.user')
    .lean();
  return summarizeViewer({ shares, memberIds, viewerId, range, now, timeZone });
}

module.exports = {
  VIEWER_SUMMARY_RANGES,
  summarizeViewer,
  getViewerSummary,
  isValidTimeZone,
  windowFor,
  inWindow,
  longestDayRun
};
