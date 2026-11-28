const mongoose = require('mongoose');
const Share = require('../models/Share');
const User = require('../models/User');
const { windowFor, inWindow, longestDayRun } = require('./viewerSummaryService');

/**
 * "The songs" cards of Group Dynamics (#56, #150): the shares the viewer is
 * sleeping on, the viewer's shares the group slept on, and group records.
 *
 * `summarizeSongs` is pure. Shares by former members count for no one, and
 * only current members' listens and likes count.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 5;
// A share has to be this old before it counts as slept on.
const SLEPT_ON_AFTER_MS = DAY_MS;

const id = (value) => (value == null ? null : value.toString());

function row(share, names) {
  const sharer = id(share.sharedBy);
  return {
    shareId: id(share._id),
    spotifyTrackId: share.spotifyTrackId,
    trackName: share.trackName,
    artistName: share.artistName,
    trackImage: share.trackImage ?? null,
    sharedBy: { id: sharer, displayName: names[sharer] ?? null },
    sharedAt: new Date(share.createdAt).toISOString()
  };
}

/**
 * @param {Object} args
 * @param {Array} args.shares - every share in the group, any order
 * @param {Array} args.memberIds - the group's current members
 * @param {Object} args.names - member id -> display name
 * @param {string} args.viewerId
 * @param {'7d'|'30d'|'all'} args.range
 * @param {Date} args.now
 * @param {string} args.timeZone - IANA zone for counting calendar days
 */
function summarizeSongs({ shares, memberIds, names, viewerId, range, now, timeZone }) {
  const members = new Set(memberIds.map(id));
  const viewer = id(viewerId);
  const window = windowFor(range, now);
  // Newest first; ties keep a stable order by id.
  const inRange = shares
    .filter((s) => members.has(id(s.sharedBy)) && inWindow(s.createdAt, window))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || id(b._id).localeCompare(id(a._id)));

  const listenersOf = (share) => new Set(share.listeners.map((l) => id(l.user)).filter((u) => members.has(u)));
  const othersOf = (sharer) => [...members].filter((m) => m !== sharer);

  const sleeping = inRange.filter((s) => id(s.sharedBy) !== viewer && !listenersOf(s).has(viewer));

  const viewerOthers = othersOf(viewer).length;
  const slept = viewerOthers === 0 ? [] : inRange
    .filter((s) => id(s.sharedBy) === viewer
      && now.getTime() - new Date(s.createdAt).getTime() >= SLEPT_ON_AFTER_MS
      && ![...listenersOf(s)].some((u) => u !== viewer))
    .reverse();

  let fastestFullListen = null;
  let mostLiked = null;
  for (const share of inRange) {
    const sharer = id(share.sharedBy);
    const others = othersOf(sharer);
    if (others.length === 0) continue;

    const lastListen = Math.max(...others.map((m) => {
      const listen = share.listeners.find((l) => id(l.user) === m);
      return listen ? new Date(listen.listenedAt).getTime() : NaN;
    }));
    if (!Number.isNaN(lastListen)) {
      const ms = Math.max(0, lastListen - new Date(share.createdAt).getTime());
      if (!fastestFullListen || ms < fastestFullListen.ms) {
        fastestFullListen = { ...row(share, names), ms };
      }
    }

    const likes = new Set(share.likes.map((l) => id(l.user)).filter((u) => u !== sharer && members.has(u))).size;
    // Shares come newest first, so a later tie keeps the more recent share.
    if (likes > 0 && (!mostLiked || likes > mostLiked.likes)) {
      mostLiked = { ...row(share, names), likes, others: others.length };
    }
  }

  const streakDays = longestDayRun(inRange.map((s) => new Date(s.createdAt)), timeZone);

  return {
    range,
    sleepingOn: {
      shares: sleeping.slice(0, LIST_LIMIT).map((s) => row(s, names)),
      total: sleeping.length
    },
    sleptOn: {
      shares: slept.slice(0, LIST_LIMIT).map((s) => row(s, names)),
      total: slept.length,
      others: viewerOthers
    },
    records: {
      fastestFullListen,
      mostLiked,
      longestStreak: streakDays > 0 ? { days: streakDays } : null
    }
  };
}

/**
 * Load the group's shares and members' names and summarize them for the
 * viewer. The caller has already checked membership (isGroupMember).
 */
async function getSongsSummary(groupId, memberIds, viewerId, range, timeZone, now = new Date()) {
  const [shares, users] = await Promise.all([
    Share.find({ group: new mongoose.Types.ObjectId(groupId) })
      .select('sharedBy spotifyTrackId trackName artistName trackImage createdAt listeners.user listeners.listenedAt likes.user')
      .lean(),
    User.find({ _id: { $in: memberIds } }).select('displayName').lean()
  ]);
  const names = Object.fromEntries(users.map((u) => [id(u._id), u.displayName]));
  return summarizeSongs({ shares, memberIds, names, viewerId, range, now, timeZone });
}

module.exports = {
  LIST_LIMIT,
  summarizeSongs,
  getSongsSummary
};
