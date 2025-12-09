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
   * @param {string} timeRange - '24h' or '7d'
   */
  static async getGroupActivity(groupId, timeRange = '7d') {
    const now = new Date();
    let startDate = new Date();

    if (timeRange === '24h') {
      startDate.setHours(now.getHours() - 24);
    } else {
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

    // Map to simplified format for frontend Recharts
    return shares.map(s => ({
      timestamp: s._id,
      shares: s.count,
      activity: s.count + s.likes + s.listens // Total "Noise"/Amplitude
    }));
  }

  /**
   * Get stats for solar system (Member engagement)
   * Returns list of members with their "planet" stats.
   * @param {string} groupId 
   */
  static async getMemberStats(groupId) {
    const gid = new mongoose.Types.ObjectId(groupId);

    // 1. Aggregation to get stats for users who have shared
    const shareStats = await Share.aggregate([
      { $match: { group: gid } },
      {
        $group: {
          _id: "$sharedBy",
          shareCount: { $sum: 1 },
          totalLikesReceived: { $sum: "$likeCount" },
          lastSharedAt: { $max: "$createdAt" }
        }
      }
    ]);

    // Map stats for easy lookup
    const statsMap = {};
    shareStats.forEach(s => {
      statsMap[s._id.toString()] = s;
    });

    // 2. Get all members from group to ensure we include inactive ones (planets far away)
    const group = await Group.findById(groupId).populate('members', 'displayName profileImage');

    if (!group) throw new Error('Group not found');

    return group.members.map(member => {
      const s = statsMap[member._id.toString()] || {};
      const shareCount = s.shareCount || 0;
      const likesReceived = s.totalLikesReceived || 0;

      return {
        userId: member._id,
        displayName: member.displayName,
        profileImage: member.profileImage,
        shareCount,
        totalLikesReceived: likesReceived,
        lastActive: s.lastSharedAt || null,
        // Derived metrics for UI
        planetSize: shareCount + likesReceived, // Influence
        orbitDistance: s.lastSharedAt ? (new Date() - new Date(s.lastSharedAt)) : -1 // -1 means infinite/far
      };
    });
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
