const mongoose = require('mongoose');
const Share = require('../models/Share');
const User = require('../models/User');
const { RANGE_DAYS, windowFor, inWindow } = require('./viewerSummaryService');

/**
 * The "Between you" section of Group Dynamics (#56, #145): how the viewer and
 * the other members like and listen to each other's shares in one period.
 *
 * `summarizeBetween` is pure and works from fields Share already stores.
 * `getBetweenYou` loads the shares and the members' names and calls it.
 */

// Each side needs this many shares in the period before a pair gets a verdict,
// and a member needs this many before they can be the viewer's tastemaker.
const MIN_SHARES = 3;
// A pair's lower like rate must reach this to be anyone's closest match.
const CLOSEST_MATCH_FLOOR = 1 / 3;
// Rates this far apart make a pair one-sided.
const ONE_SIDED_GAP = 0.3;
// Both rates under this: different wavelengths.
const DIFFERENT_WAVELENGTHS_CEILING = 0.2;

const id = (value) => (value == null ? null : value.toString());

/** Per other member, for one window: shares both ways, likes both ways, listens on the viewer's shares. */
function pairStats(shares, members, viewer, window) {
  const others = members.filter((m) => m !== viewer);
  const stats = new Map(others.map((m) => [m, {
    theirShares: 0,
    youLiked: 0,
    theyLiked: 0,
    listens: 0
  }]));
  let yourShares = 0;

  for (const share of shares) {
    if (!inWindow(share.createdAt, window)) continue;
    const sharer = id(share.sharedBy);
    const likers = new Set(share.likes.map((l) => id(l.user)));
    if (sharer === viewer) {
      yourShares += 1;
      const listeners = new Set(share.listeners.map((l) => id(l.user)));
      for (const [member, s] of stats) {
        if (likers.has(member)) s.theyLiked += 1;
        if (listeners.has(member)) s.listens += 1;
      }
    } else if (stats.has(sharer)) {
      // Shares by former members count for no one.
      const s = stats.get(sharer);
      s.theirShares += 1;
      if (likers.has(viewer)) s.youLiked += 1;
    }
  }
  return { stats, yourShares };
}

const rate = (n, total) => (total > 0 ? n / total : 0);
const lowerRate = (s, yourShares) => Math.min(rate(s.youLiked, s.theirShares), rate(s.theyLiked, yourShares));
const judged = (s, yourShares) => s.theirShares >= MIN_SHARES && yourShares >= MIN_SHARES;

function verdictFor(member, { stats, yourShares }) {
  const s = stats.get(member);
  if (!judged(s, yourShares)) return { id: 'too_early' };

  const closeness = lowerRate(s, yourShares);
  if (closeness >= CLOSEST_MATCH_FLOOR) {
    const closer = [...stats.values()].some((o) => judged(o, yourShares) && lowerRate(o, yourShares) > closeness);
    if (!closer) return { id: 'closest_match' };
  }
  const yours = rate(s.youLiked, s.theirShares);
  const theirs = rate(s.theyLiked, yourShares);
  if (Math.abs(yours - theirs) >= ONE_SIDED_GAP) {
    return { id: 'one_sided', leaning: yours > theirs ? 'you' : 'them' };
  }
  if (yours < DIFFERENT_WAVELENGTHS_CEILING && theirs < DIFFERENT_WAVELENGTHS_CEILING) {
    return { id: 'different_wavelengths' };
  }
  return { id: 'common_ground' };
}

/**
 * The members who lead on `score`, with `tieBreak` deciding between equals;
 * members still level all lead. Members scoring 0 never lead.
 */
function leaders(entries, score, tieBreak) {
  let best = [];
  for (const entry of entries) {
    if (score(entry) <= 0) continue;
    const lead = best[0];
    const cmp = lead ? score(entry) - score(lead) || tieBreak(entry) - tieBreak(lead) : 1;
    if (cmp > 0) best = [entry];
    else if (cmp === 0) best.push(entry);
  }
  return best;
}

/**
 * @param {Object} args
 * @param {Array} args.shares - every share in the group, any order
 * @param {Array} args.memberIds - the group's current members
 * @param {string} args.viewerId
 * @param {string} [args.memberId] - the other member for the pair; defaults to the one with the most likes between you
 * @param {'7d'|'30d'|'all'} args.range
 * @param {Date} args.now
 */
function summarizeBetween({ shares, memberIds, viewerId, memberId, range, now }) {
  const members = memberIds.map(id);
  const viewer = id(viewerId);
  const current = pairStats(shares, members, viewer, windowFor(range, now));
  const { stats, yourShares } = current;
  const others = [...stats.entries()].map(([member, s]) => ({ member, ...s }));

  if (others.length === 0) {
    return { range, pair: null, biggestFan: null, tastemaker: null };
  }

  const pairMember = memberId != null
    ? id(memberId)
    : leaders(others, (o) => o.youLiked + o.theyLiked + 1, () => 0)[0].member;
  if (!stats.has(pairMember)) {
    const error = new Error('member must be another current member of the group');
    error.statusCode = 400;
    throw error;
  }

  const p = stats.get(pairMember);
  const pair = {
    member: pairMember,
    theirShares: p.theirShares,
    youLiked: p.youLiked,
    yourShares,
    theyLiked: p.theyLiked,
    verdict: verdictFor(pairMember, current),
    previousVerdict: RANGE_DAYS[range]
      ? verdictFor(pairMember, pairStats(shares, members, viewer, windowFor(range, now, 1)))
      : null
  };

  const fans = leaders(others, (o) => o.listens + o.theyLiked, (o) => o.theyLiked);
  const biggestFan = fans.length === 0 ? null : {
    members: fans.map((o) => o.member),
    listens: fans[0].listens,
    likes: fans[0].theyLiked,
    yourShares
  };

  const eligible = others.filter((o) => o.theirShares >= MIN_SHARES);
  const makers = leaders(eligible, (o) => rate(o.youLiked, o.theirShares), (o) => o.youLiked);
  const tastemaker = makers.length === 0 ? null : {
    members: makers.map((o) => o.member),
    liked: makers[0].youLiked,
    shares: makers[0].theirShares
  };

  return { range, pair, biggestFan, tastemaker };
}

/**
 * Load the group's shares and the members' names, and summarize them for the
 * viewer. The caller has already checked that the viewer is a member and
 * passes the group's member ids (isGroupMember loaded the group).
 */
async function getBetweenYou(groupId, memberIds, viewerId, memberId, range, now = new Date()) {
  const viewer = id(viewerId);
  const otherIds = memberIds.map(id).filter((m) => m !== viewer);
  const [shares, users] = await Promise.all([
    Share.find({ group: new mongoose.Types.ObjectId(groupId) })
      .select('sharedBy createdAt listeners.user likes.user')
      .lean(),
    User.find({ _id: { $in: otherIds } }).select('displayName profileImage').lean()
  ]);
  const summary = summarizeBetween({ shares, memberIds, viewerId, memberId, range, now });
  const members = users
    .map((u) => ({ userId: id(u._id), displayName: u.displayName, profileImage: u.profileImage ?? null }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { ...summary, members };
}

module.exports = { summarizeBetween, getBetweenYou };
