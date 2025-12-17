const mongoose = require('mongoose');
const Share = require('../models/Share');
const User = require('../models/User');
const Group = require('../models/Group');

/**
 * Analytics Service
 * Handles data aggregation for visual analytics features:
 * - Group Activity (Waveform)
 * - Solar System (Member Engagement)
 * - Hall of Fame (Superlatives)
 */
class AnalyticsService {
  /**
   * Get aggregated activity for a group (waveform data)
   * @param {string} groupId
   * @param {string} timeRange - '24h' | '7d' | '30d' | '90d' | 'all'
   */
  static async getGroupActivity(groupId, timeRange = '7d') {
    const now = new Date();
    let startDate = new Date();

    if (timeRange === '24h') {
      startDate.setHours(now.getHours() - 24);
    } else if (timeRange === '7d' || !timeRange) {
      // For daily buckets, calculate start date in UTC to match bucket alignment
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 7,
        0, 0, 0, 0
      ));
    } else if (timeRange === '30d') {
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 30,
        0, 0, 0, 0
      ));
    } else if (timeRange === '90d') {
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 90,
        0, 0, 0, 0
      ));
    } else if (timeRange === 'all') {
      // All-time can be huge; start at earliest share for the group,
      // but cap to the last 365 days for performance & chart readability.
      const earliest = await Share.findOne({ group: new mongoose.Types.ObjectId(groupId) })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean();

      startDate = earliest?.createdAt ? new Date(earliest.createdAt) : new Date(0);

      const days = (now.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
      if (days > 365) {
        startDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - 365,
          0, 0, 0, 0
        ));
      }
    } else {
      // Backward-compatible default
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 7,
        0, 0, 0, 0
      ));
    }

    // Aggregate shares by time bucket
    // For 7d, bucket by day. For 24h, bucket by hour.
    // MongoDB aggregation requires careful date math.
    const interval = timeRange === '24h' ? 3600 * 1000 : 24 * 3600 * 1000; // ms

    // For daily buckets, align to midnight UTC
    // For hourly buckets, align to the hour
    const bucketExpression = timeRange === '24h' 
      ? {
          $toDate: {
            $subtract: [
              { $toLong: "$createdAt" },
              { $mod: [{ $toLong: "$createdAt" }, interval] }
            ]
          }
        }
      : {
          // For daily buckets, align to midnight UTC
          $dateFromParts: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            hour: 0,
            minute: 0,
            second: 0,
            timezone: "UTC"
          }
        };

    // For daily buckets, ensure we include all of today by using end of today as upper bound
    // For hourly buckets, just use startDate as lower bound
    const matchFilter = {
      group: new mongoose.Types.ObjectId(groupId),
      createdAt: { $gte: startDate }
    };
    
    // For daily buckets, also ensure we include data up to end of today
    if (timeRange !== '24h') {
      const endOfTodayUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1, // Next day at midnight = end of today
        0, 0, 0, 0
      ));
      matchFilter.createdAt.$lt = endOfTodayUTC;
    }

    const shares = await Share.aggregate([
      {
        $match: matchFilter
      },
      {
        $group: {
          _id: bucketExpression,
          count: { $sum: 1 },
          likes: { $sum: "$likeCount" },
          listens: { $sum: "$listenCount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Backfill missing buckets so the waveform always renders a full series
    // (Recharts can look blank with 1-2 sparse points).
    const bucketMap = new Map();
    shares.forEach((s) => {
      // MongoDB returns _id as a Date object, ensure we get the timestamp correctly
      const bucketDate = s._id instanceof Date ? s._id : new Date(s._id);
      // For daily buckets, normalize to midnight UTC to ensure exact matching
      let ts = bucketDate.getTime();
      if (timeRange !== '24h') {
        // Normalize to midnight UTC for exact bucket matching
        const normalized = new Date(Date.UTC(
          bucketDate.getUTCFullYear(),
          bucketDate.getUTCMonth(),
          bucketDate.getUTCDate(),
          0, 0, 0, 0
        ));
        ts = normalized.getTime();
      }
      bucketMap.set(ts, {
        timestamp: timeRange !== '24h' ? new Date(ts) : bucketDate,
        shares: s.count,
        activity: s.count + s.likes + s.listens,
      });
    });

    // Align start and end to bucket boundaries
    let alignedStart, alignedEnd;
    
    if (timeRange === '24h') {
      // For hourly buckets, align to hour boundaries
      const startMs = new Date(startDate).getTime();
      const endMs = now.getTime();
      alignedStart = startMs - (startMs % interval);
      alignedEnd = endMs - (endMs % interval) + interval; // Include current hour
    } else {
      // For daily buckets, align to midnight UTC
      const startDateUTC = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        0, 0, 0, 0
      ));
      const endDateUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));
      // Add one day to include today
      alignedStart = startDateUTC.getTime();
      alignedEnd = endDateUTC.getTime() + interval; // Include current day
    }

    const series = [];
    // Use < instead of <= since alignedEnd is already one interval ahead
    for (let t = alignedStart; t < alignedEnd; t += interval) {
      if (bucketMap.has(t)) {
        series.push(bucketMap.get(t));
      } else {
        series.push({
          timestamp: new Date(t),
          shares: 0,
          activity: 0,
        });
      }
    }

    return series;
  }

  /**
   * Get Vibe Radar stats (Member Personality)
   * Returns list of members with their normalized scores (0-100) on 5 axes.
   * @param {string} groupId 
   * @param {string} timeRange - '24h' | '7d' | '30d' | '90d' | 'all'
   */
  static async getMemberVibes(groupId, timeRange = 'all') {
    const gid = new mongoose.Types.ObjectId(groupId);

    // Calculate start date based on timeRange
    const now = new Date();
    let startDate = new Date();

    if (timeRange === '24h') {
      startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeRange === 'all') {
      // For 'all', use all shares but cap to 365 days for performance
      const earliest = await Share.findOne({ group: gid })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean();

      startDate = earliest?.createdAt ? new Date(earliest.createdAt) : new Date(0);

      const days = (now.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
      if (days > 365) {
        startDate = new Date();
        startDate.setDate(now.getDate() - 365);
      }
    } else {
      // Default to 'all' if invalid timeRange
      startDate = new Date(0);
    }

    // Build match filter with date range
    const matchFilter = { group: gid };
    if (timeRange !== 'all' || startDate.getTime() > 0) {
      matchFilter.createdAt = { $gte: startDate };
    }

    // 1. Aggregation for Shared By Me (Activity, Popularity, Variety, Freshness)
    const shareStats = await Share.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$sharedBy",
          shareCount: { $sum: 1 }, // Activity
          totalLikesReceived: { $sum: "$likeCount" }, // Popularity (Numerator)
          uniqueArtists: { $addToSet: "$artistName" }, // Variety
          lastSharedAt: { $max: "$createdAt" } // Freshness
        }
      }
    ]);

    // 2. Aggregation for Likes Given (Support)
    // Note: We need to filter likes by the time range of when the share was created
    const likeStats = await Share.aggregate([
      { $match: matchFilter },
      { $unwind: "$likes" },
      { $group: { _id: "$likes.user", likesGiven: { $sum: 1 } } }
    ]);

    // Map stats for lookup
    const statsMap = {};
    shareStats.forEach(s => {
      statsMap[s._id.toString()] = {
        ...s,
        avgLikesReceived: s.shareCount > 0 ? (s.totalLikesReceived / s.shareCount) : 0,
        varietyCount: s.uniqueArtists.length
      };
    });

    const supportMap = {};
    likeStats.forEach(l => {
      supportMap[l._id.toString()] = l.likesGiven;
    });

    // 3. Normalize Scores (Find Maxima)
    let maxActivity = 0;
    let maxPopularity = 0;
    let maxSupport = 0;
    let maxVariety = 0;
    // Freshness is calculated relative to time, not max user

    Object.values(statsMap).forEach(s => {
      if (s.shareCount > maxActivity) maxActivity = s.shareCount;
      if (s.avgLikesReceived > maxPopularity) maxPopularity = s.avgLikesReceived;
      if (s.varietyCount > maxVariety) maxVariety = s.varietyCount;
    });

    Object.values(supportMap).forEach(val => {
      if (val > maxSupport) maxSupport = val;
    });

    // 4. Build Result
    const group = await Group.findById(groupId).populate('members', 'displayName profileImage');
    if (!group) throw new Error('Group not found');

    return group.members.map(member => {
      const mid = member._id.toString();
      const s = statsMap[mid] || { shareCount: 0, avgLikesReceived: 0, varietyCount: 0, lastSharedAt: null };
      const likesGiven = supportMap[mid] || 0;

      // Calculate Scores (0-100)

      // Activity: Raw share count vs max
      const activityScore = maxActivity > 0 ? Math.round((s.shareCount / maxActivity) * 100) : 0;

      // Popularity: Avg likes per share vs max
      const popularityScore = maxPopularity > 0 ? Math.round((s.avgLikesReceived / maxPopularity) * 100) : 0;

      // Support: Likes given vs max
      const supportScore = maxSupport > 0 ? Math.round((likesGiven / maxSupport) * 100) : 0;

      // Variety: Unique artists vs max
      const varietyScore = maxVariety > 0 ? Math.round((s.varietyCount / maxVariety) * 100) : 0;

      // Freshness: Decay function. 
      // 100 if active < 24h. 
      // Lose 5 points per day. Min 0.
      let freshnessScore = 0;
      if (s.lastSharedAt) {
        const daysDiff = (now - new Date(s.lastSharedAt)) / (1000 * 3600 * 24);
        freshnessScore = Math.max(0, Math.round(100 - (daysDiff * 5)));
      }

      return {
        userId: member._id,
        displayName: member.displayName,
        profileImage: member.profileImage,
        stats: {
          activity: activityScore,
          popularity: popularityScore,
          support: supportScore,
          variety: varietyScore,
          freshness: freshnessScore
        },
        raw: {
          shares: s.shareCount,
          likesGiven,
          avgLikesReceived: s.avgLikesReceived.toFixed(1)
        }
      };
    }).sort((a, b) => b.stats.activity - a.stats.activity); // Sort by activity for default view
  }

  /**
   * Get Superlatives (Hall of Fame)
   * @param {string} groupId 
   */
  static async getSuperlatives(groupId) {
    const gid = new mongoose.Types.ObjectId(groupId);
    const rules = [
      // 1. The Hype Man: Most likes GIVEN
      {
        key: 'hypeMan',
        label: 'The Hype Man',
        description: 'Most likes given',
        icon: '❤️',
        pipeline: [
          { $match: { group: gid } },
          { $unwind: "$likes" },
          { $group: { _id: "$likes.user", value: { $sum: 1 } } },
          { $sort: { value: -1 } },
          { $limit: 1 }
        ]
      },
      // 2. The Trendsetter: Most likes RECEIVED
      {
        key: 'trendsetter',
        label: 'The Trendsetter',
        description: 'Most likes received',
        icon: '✨',
        pipeline: [
          { $match: { group: gid } },
          { $group: { _id: "$sharedBy", value: { $sum: "$likeCount" } } },
          { $sort: { value: -1 } },
          { $limit: 1 }
        ]
      },
      // 3. The DJ: Most Shares
      {
        key: 'dj',
        label: 'The DJ',
        description: 'Most tracks shared',
        icon: '🎧',
        pipeline: [
          { $match: { group: gid } },
          { $group: { _id: "$sharedBy", value: { $sum: 1 } } },
          { $sort: { value: -1 } },
          { $limit: 1 }
        ]
      },
      // 4. The Diehard: Most Listens (using listeners array)
      {
        key: 'diehard',
        label: 'The Diehard',
        description: 'Most tracks listened',
        icon: '👂',
        pipeline: [
          { $match: { group: gid } },
          { $unwind: "$listeners" },
          { $group: { _id: "$listeners.user", value: { $sum: 1 } } },
          { $sort: { value: -1 } },
          { $limit: 1 }
        ]
      }
    ];

    const results = {};

    // Execute all aggregations in parallel
    await Promise.all(rules.map(async (rule) => {
      const aggResult = await Share.aggregate(rule.pipeline);
      if (aggResult.length > 0) {
        const userId = aggResult[0]._id;
        const value = aggResult[0].value;
        const user = await User.findById(userId).select('displayName profileImage');

        if (user) {
          results[rule.key] = {
            user,
            value,
            label: rule.label,
            description: rule.description,
            icon: rule.icon
          };
        }
      }
    }));

    return results;
  }
}

module.exports = AnalyticsService;
