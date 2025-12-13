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
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(now.getDate() - 90);
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
        startDate = new Date();
        startDate.setDate(now.getDate() - 365);
      }
    } else {
      // Backward-compatible default
      startDate.setDate(now.getDate() - 7);
    }

    // Aggregate shares by time bucket
    // For 7d, bucket by day. For 24h, bucket by hour.
    // MongoDB aggregation requires careful date math.
    const interval = timeRange === '24h' ? 3600 * 1000 : 24 * 3600 * 1000; // ms

    const shares = await Share.aggregate([
      {
        $match: {
          group: new mongoose.Types.ObjectId(groupId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: "$createdAt" },
                { $mod: [{ $toLong: "$createdAt" }, interval] }
              ]
            }
          },
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
      const ts = new Date(s._id).getTime();
      bucketMap.set(ts, {
        timestamp: new Date(s._id),
        shares: s.count,
        activity: s.count + s.likes + s.listens,
      });
    });

    const startMs = new Date(startDate).getTime();
    const endMs = now.getTime();

    // Align start to bucket boundary
    const alignedStart = startMs - (startMs % interval);
    const alignedEnd = endMs - (endMs % interval);

    const series = [];
    for (let t = alignedStart; t <= alignedEnd; t += interval) {
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
   */
  static async getMemberVibes(groupId) {
    const gid = new mongoose.Types.ObjectId(groupId);

    // 1. Aggregation for Shared By Me (Activity, Popularity, Variety, Freshness)
    const shareStats = await Share.aggregate([
      { $match: { group: gid } },
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
    const likeStats = await Share.aggregate([
      { $match: { group: gid } },
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

    const now = new Date();

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
