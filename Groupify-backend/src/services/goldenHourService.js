const mongoose = require('mongoose');
const Share = require('../models/Share');

/**
 * Golden hour and group streak, in "The group" part of Group Dynamics (#56,
 * slice 5, #147): when in the week the group shares and listens, and how many
 * days in a row it has been active.
 *
 * `summarizeGoldenHour` is pure: it takes every share the group has ever had
 * and works everything out in the viewer's time zone. `getGoldenHour` loads
 * the shares and calls it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { '7d': 7, '30d': 30 };
const GOLDEN_HOUR_RANGES = ['7d', '30d', 'all'];

/** Six 4-hour bands of the viewer's day. */
const TIME_OF_DAY_BUCKETS = [
  { id: 'late_night', label: 'Late night', startHour: 0, endHour: 4 },
  { id: 'early_morning', label: 'Early morning', startHour: 4, endHour: 8 },
  { id: 'morning', label: 'Morning', startHour: 8, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 16 },
  { id: 'evening', label: 'Evening', startHour: 16, endHour: 20 },
  { id: 'night', label: 'Night', startHour: 20, endHour: 24 }
];
const BUCKET_HOURS = 4;

// Rows of the heatmap, Monday first. Keys are Intl's en-US short weekdays.
const WEEKDAY_ROW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const id = (value) => (value == null ? null : value.toString());
const emptyGrid = () => Array.from({ length: 7 }, () => new Array(TIME_OF_DAY_BUCKETS.length).fill(0));

/**
 * Turns a date into its weekday row, time-of-day column and day number
 * (days since 1970-01-01) in one time zone. One formatter per call keeps
 * this fast for a few thousand dates.
 */
function localClock(timeZone) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  return (date) => {
    const parts = {};
    for (const { type, value } of format.formatToParts(date)) parts[type] = value;
    return {
      row: WEEKDAY_ROW[parts.weekday],
      column: Math.floor(Number(parts.hour) / BUCKET_HOURS),
      day: Date.parse(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`) / DAY_MS
    };
  };
}

/**
 * Runs of consecutive day numbers, as { start, end }, from a sorted,
 * de-duplicated list.
 */
function dayRuns(days) {
  const runs = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && day - last.end === 1) last.end = day;
    else runs.push({ start: day, end: day });
  }
  return runs;
}

const runLength = ({ start, end }) => end - start + 1;

/**
 * The run of active days ending today, or yesterday when nothing has
 * happened yet today, so the streak doesn't reset every morning.
 */
function currentRun(activeDays, today) {
  let day = activeDays.has(today) ? today : today - 1;
  let run = 0;
  while (activeDays.has(day)) {
    run += 1;
    day -= 1;
  }
  return run;
}

/**
 * Every share and listen by a current member, with its time. A member's
 * listen of their own share is left out, as everywhere in Group Dynamics.
 */
function activityEvents(shares, members) {
  const events = [];
  for (const share of shares) {
    const sharer = id(share.sharedBy);
    if (members.has(sharer)) events.push({ kind: 'share', at: new Date(share.createdAt) });
    for (const listen of share.listeners || []) {
      const listener = id(listen.user);
      if (listener !== sharer && members.has(listener) && listen.listenedAt) {
        events.push({ kind: 'listen', at: new Date(listen.listenedAt) });
      }
    }
  }
  return events;
}

/**
 * @param {Object} args
 * @param {Array} args.shares - every share in the group, any order
 * @param {Array} args.memberIds - the group's current members
 * @param {'7d'|'30d'|'all'} args.range
 * @param {Date} args.now
 * @param {string} args.timeZone - IANA zone the viewer's days and hours are in
 * @returns {{ range, buckets, shares: number[][], listens: number[][], totals, streak }}
 *   `shares` and `listens` are 7 rows (Monday first) by 6 time-of-day columns.
 */
function summarizeGoldenHour({ shares, memberIds, range, now, timeZone }) {
  const members = new Set(memberIds.map(id));
  const clock = localClock(timeZone);
  const start = RANGE_DAYS[range] ? now.getTime() - RANGE_DAYS[range] * DAY_MS : null;
  const inRange = (date) => (start === null || date.getTime() >= start) && date.getTime() < now.getTime();

  const grids = { share: emptyGrid(), listen: emptyGrid() };
  const totals = { shares: 0, listens: 0 };
  const allDays = new Set();

  for (const event of activityEvents(shares, members)) {
    const { row, column, day } = clock(event.at);
    allDays.add(day);
    if (!inRange(event.at)) continue;
    grids[event.kind][row][column] += 1;
    totals[event.kind === 'share' ? 'shares' : 'listens'] += 1;
  }

  // A run counts for the period when any of its days falls in it, at its
  // full length, so "longest in this period" is never shorter than the
  // streak running now.
  const runs = dayRuns([...allDays].sort((a, b) => a - b));
  const firstRangeDay = start === null ? -Infinity : clock(new Date(start)).day;
  const longestOf = (list) => Math.max(0, ...list.map(runLength));
  return {
    range,
    buckets: TIME_OF_DAY_BUCKETS,
    shares: grids.share,
    listens: grids.listen,
    totals,
    streak: {
      current: currentRun(allDays, clock(now).day),
      longest: longestOf(runs.filter((run) => run.end >= firstRangeDay)),
      record: longestOf(runs)
    }
  };
}

/**
 * Load the group's shares and summarize them. The caller has already checked
 * that the viewer is a member and passes the group's member ids.
 */
async function getGoldenHour(groupId, memberIds, range, timeZone, now = new Date()) {
  const shares = await Share.find({ group: new mongoose.Types.ObjectId(groupId) })
    .select('sharedBy createdAt listeners.user listeners.listenedAt')
    .lean();
  return summarizeGoldenHour({ shares, memberIds, range, now, timeZone });
}

module.exports = {
  GOLDEN_HOUR_RANGES,
  TIME_OF_DAY_BUCKETS,
  summarizeGoldenHour,
  getGoldenHour
};
