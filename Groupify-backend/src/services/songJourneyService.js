const mongoose = require('mongoose');
const Share = require('../models/Share');
const User = require('../models/User');

/**
 * "The songs" in Group Dynamics (#56, #148): for each share, how long after
 * it was shared each member listened. The song picker and the song journey
 * are both built from this.
 *
 * `summarizeSongs` is pure; `getSongs` loads the shares and members and
 * calls it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { '7d': 7, '30d': 30 };
const SONG_RANGES = ['7d', '30d', 'all'];

const id = (value) => (value == null ? null : value.toString());

/** How long after the share a listen came, in ms. */
function waitFor(listen, sharedAt) {
  if (listen.timeToListen != null) return listen.timeToListen;
  return Math.max(0, new Date(listen.listenedAt).getTime() - new Date(sharedAt).getTime());
}

/**
 * @param {Object} args
 * @param {Array} args.shares - the group's shares, any order
 * @param {Array} args.memberIds - the group's current members, in group order
 * @param {string} args.viewerId
 * @param {'7d'|'30d'|'all'} args.range
 * @param {Date} args.now
 * @param {string} [args.shareId] - a share to keep even when it's older than the period
 */
function summarizeSongs({ shares, memberIds, viewerId, range, now, shareId = null }) {
  const members = memberIds.map(id);
  const current = new Set(members);
  const days = RANGE_DAYS[range];
  const start = days ? now.getTime() - days * DAY_MS : null;

  const songs = shares
    .filter((share) => start === null
      || new Date(share.createdAt).getTime() >= start
      || id(share._id) === id(shareId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((share) => {
      // A former member's share counts for no one: no one owns it, and
      // everyone still in the group is its audience.
      const sharer = current.has(id(share.sharedBy)) ? id(share.sharedBy) : null;
      const audience = members.filter((m) => m !== sharer);
      const listens = share.listeners
        .filter((l) => audience.includes(id(l.user)))
        .map((l) => ({ memberId: id(l.user), afterMs: waitFor(l, share.createdAt) }))
        .sort((a, b) => a.afterMs - b.afterMs);
      const everyone = audience.length > 0 && audience.every((m) => listens.some((l) => l.memberId === m));
      return {
        shareId: id(share._id),
        trackName: share.trackName,
        artistName: share.artistName,
        trackImage: share.trackImage ?? null,
        sharedBy: sharer,
        sharedAt: new Date(share.createdAt).toISOString(),
        audience: audience.length,
        listens,
        spreadMs: everyone ? listens[listens.length - 1].afterMs : null
      };
    });

  return { range, viewerId: id(viewerId), members, songs };
}

/**
 * Load the group's shares and current members and summarize them.
 * The caller has checked that the viewer is a member (isGroupMember).
 * A `shareId` that isn't one of this group's shares is a 404.
 */
async function getSongs(groupId, memberIds, viewerId, range, shareId = null, now = new Date()) {
  const group = new mongoose.Types.ObjectId(groupId);
  if (shareId && !(await Share.exists({ _id: shareId, group }))) {
    const error = new Error('That share is no longer in this group.');
    error.statusCode = 404;
    throw error;
  }
  const [shares, users] = await Promise.all([
    Share.find({ group })
      .select('sharedBy trackName artistName trackImage createdAt listeners.user listeners.listenedAt listeners.timeToListen')
      .lean(),
    User.find({ _id: { $in: memberIds } }).select('displayName profileImage').lean()
  ]);
  const summary = summarizeSongs({ shares, memberIds, viewerId, range, now, shareId });
  const byId = new Map(users.map((u) => [id(u._id), u]));
  return {
    ...summary,
    members: summary.members.map((memberId) => ({
      id: memberId,
      displayName: byId.get(memberId)?.displayName ?? 'Member',
      profileImage: byId.get(memberId)?.profileImage ?? null
    }))
  };
}

module.exports = { SONG_RANGES, summarizeSongs, getSongs };
