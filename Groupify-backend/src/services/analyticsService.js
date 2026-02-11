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
   * Calculate median from sorted array
   * @param {number[]} values - Array of numbers
   * @returns {number|null} Median value or null if empty
   */
  static median(values) {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[Math.floor(mid)];
  }

  /**
   * Calculate p-th percentile
   * @param {number[]} values - Array of numbers
   * @param {number} percentile - Percentile (0-100)
   * @returns {number|null} Percentile value or null if empty
   */
  static percentile(values, percentile) {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    
    if (percentile === 50) {
      const mid = sorted.length / 2;
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[Math.floor(mid)];
    }
    
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate arithmetic mean
   * @param {number[]} values - Array of numbers
   * @returns {number} Mean value (0 if empty)
   */
  static mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   * @param {number[]} values - Array of numbers
   * @returns {number} Standard deviation (0 if empty or single value)
   */
  static std(values) {
    if (!values || values.length === 0 || values.length === 1) return 0;
    const avg = this.mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Clamp value to range [min, max]
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Log-normalized scaling with +1 offset to avoid log(0)
   * @param {number} value - Value to normalize
   * @param {number} maxValue - Maximum value for normalization
   * @returns {number} Normalized value in [0, 1] range
   */
  static logNormalize(value, maxValue) {
    if (maxValue <= 0) return 1;
    const logValue = Math.log(value + 1);
    const logMax = Math.log(maxValue + 1);
    return this.clamp(logValue / logMax, 0, 1);
  }
  /**
   * Get aggregated activity for a group (waveform data)
   * @param {string} groupId
   * @param {string} timeRange - '24h' | '7d' | '30d' | '90d' | 'all'
   * @param {string} mode - 'shares' | 'engagement' (default: 'shares')
   *   - 'shares': Bucket by when shares were posted (Share.createdAt)
   *   - 'engagement': Bucket by when likes/listens happened (likes.likedAt, listeners.listenedAt)
   */
  static async getGroupActivity(groupId, timeRange = '7d', mode = 'shares') {
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

    let shares;

    if (mode === 'engagement') {
      // Engagement mode: Bucket by when likes/listens actually happened
      // We need to unwind likes and listeners, then bucket by their timestamps
      
      // For engagement mode, we need to:
      // 1. Unwind likes and listeners
      // 2. Create events for each like/listen with their timestamps
      // 3. Also include shares themselves (bucket by createdAt)
      const endOfTodayUTC = timeRange !== '24h' ? new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      )) : null;

      // For engagement mode, we need to:
      // 1. Include shares that have engagement in the time range (even if share is older)
      // 2. Unwind likes and listeners
      // 3. Filter by likedAt/listenedAt timestamps
      // 4. Bucket by those timestamps
      
      const dateFilter = timeRange !== '24h' && endOfTodayUTC
        ? { $gte: startDate, $lt: endOfTodayUTC }
        : { $gte: startDate };

      // Match shares that either:
      // - Were created in the time range, OR
      // - Have likes/listens in the time range
      const matchFilter = {
        group: new mongoose.Types.ObjectId(groupId),
        $or: [
          { createdAt: dateFilter },
          { 'likes.likedAt': dateFilter },
          { 'listeners.listenedAt': dateFilter }
        ]
      };

      shares = await Share.aggregate([
        { $match: matchFilter },
        {
          $facet: {
            // Shares posted in this period
            shareBuckets: [
              { $match: { createdAt: dateFilter } },
              {
                $group: {
                  _id: timeRange === '24h' 
                    ? {
                        $toDate: {
                          $subtract: [
                            { $toLong: "$createdAt" },
                            { $mod: [{ $toLong: "$createdAt" }, interval] }
                          ]
                        }
                      }
                    : {
                        $dateFromParts: {
                          year: { $year: "$createdAt" },
                          month: { $month: "$createdAt" },
                          day: { $dayOfMonth: "$createdAt" },
                          hour: 0,
                          minute: 0,
                          second: 0,
                          timezone: "UTC"
                        }
                      },
                  count: { $sum: 1 }
                }
              }
            ],
            // Likes given in this period
            likeBuckets: [
              { $unwind: "$likes" },
              { $match: { 'likes.likedAt': dateFilter } },
              {
                $group: {
                  _id: timeRange === '24h' 
                    ? {
                        $toDate: {
                          $subtract: [
                            { $toLong: "$likes.likedAt" },
                            { $mod: [{ $toLong: "$likes.likedAt" }, interval] }
                          ]
                        }
                      }
                    : {
                        $dateFromParts: {
                          year: { $year: "$likes.likedAt" },
                          month: { $month: "$likes.likedAt" },
                          day: { $dayOfMonth: "$likes.likedAt" },
                          hour: 0,
                          minute: 0,
                          second: 0,
                          timezone: "UTC"
                        }
                      },
                  count: { $sum: 1 }
                }
              }
            ],
            // Listens in this period
            listenBuckets: [
              { $unwind: "$listeners" },
              { $match: { 'listeners.listenedAt': dateFilter } },
              {
                $group: {
                  _id: timeRange === '24h' 
                    ? {
                        $toDate: {
                          $subtract: [
                            { $toLong: "$listeners.listenedAt" },
                            { $mod: [{ $toLong: "$listeners.listenedAt" }, interval] }
                          ]
                        }
                      }
                    : {
                        $dateFromParts: {
                          year: { $year: "$listeners.listenedAt" },
                          month: { $month: "$listeners.listenedAt" },
                          day: { $dayOfMonth: "$listeners.listenedAt" },
                          hour: 0,
                          minute: 0,
                          second: 0,
                          timezone: "UTC"
                        }
                      },
                  count: { $sum: 1 }
                }
              }
            ]
          }
        },
        {
          $project: {
            allBuckets: {
              $concatArrays: [
                { $map: { input: "$shareBuckets", as: "b", in: { _id: "$$b._id", type: "share", count: "$$b.count" } } },
                { $map: { input: "$likeBuckets", as: "b", in: { _id: "$$b._id", type: "like", count: "$$b.count" } } },
                { $map: { input: "$listenBuckets", as: "b", in: { _id: "$$b._id", type: "listen", count: "$$b.count" } } }
              ]
            }
          }
        },
        { $unwind: "$allBuckets" },
        {
          $group: {
            _id: "$allBuckets._id",
            shares: {
              $sum: { $cond: [{ $eq: ["$allBuckets.type", "share"] }, "$allBuckets.count", 0] }
            },
            likes: {
              $sum: { $cond: [{ $eq: ["$allBuckets.type", "like"] }, "$allBuckets.count", 0] }
            },
            listens: {
              $sum: { $cond: [{ $eq: ["$allBuckets.type", "listen"] }, "$allBuckets.count", 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      // Shares mode: Bucket by when shares were posted (current behavior)
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

      const matchFilter = {
        group: new mongoose.Types.ObjectId(groupId),
        createdAt: { $gte: startDate }
      };
      
      if (timeRange !== '24h') {
        const endOfTodayUTC = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0, 0, 0, 0
        ));
        matchFilter.createdAt.$lt = endOfTodayUTC;
      }

      shares = await Share.aggregate([
        { $match: matchFilter },
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
    }

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
      
      // Normalize field names: shares mode uses 'count', engagement mode uses 'shares'
      const shareCount = s.shares !== undefined ? s.shares : (s.count || 0);
      const likeCount = s.likes || 0;
      const listenCount = s.listens || 0;
      
      bucketMap.set(ts, {
        timestamp: timeRange !== '24h' ? new Date(ts) : bucketDate,
        shares: shareCount,
        likes: likeCount,
        listens: listenCount,
        activity: shareCount + likeCount + listenCount,
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
    // For Activity/Variety/Freshness: filter by share createdAt
    // For Popularity (Option A): count likes where likedAt is in range (on any share by this member)
    // For Support: filter likes by likedAt (when they gave likes)
    
    const shareMatchFilter = { group: gid };
    if (timeRange !== 'all' || startDate.getTime() > 0) {
      shareMatchFilter.createdAt = { $gte: startDate };
    }

    // 1. Aggregation for Shared By Me (Activity, Variety, Freshness)
    // These are based on when shares were created
    const shareStats = await Share.aggregate([
      { $match: shareMatchFilter },
      {
        $group: {
          _id: "$sharedBy",
          shareCount: { $sum: 1 }, // Activity
          uniqueArtists: { $addToSet: "$artistName" }, // Variety
          lastSharedAt: { $max: "$createdAt" } // Freshness
        }
      }
    ]);

    // 2. Aggregation for Popularity (Option A: engagement during window)
    // Count likes received where likedAt is in the time range
    // Include all shares by members, but only count likes that happened in the time range
    const dateFilter = timeRange !== 'all' 
      ? (timeRange === '24h' 
          ? { $gte: startDate }
          : {
              $gte: startDate,
              $lt: new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
                0, 0, 0, 0
              ))
            })
      : { $exists: true };

    const popularityStats = await Share.aggregate([
      { $match: { group: gid } }, // All shares in group
      { $unwind: "$likes" },
      { $match: { 'likes.likedAt': dateFilter } },
      {
        $group: {
          _id: "$sharedBy",
          likesReceivedInWindow: { $sum: 1 },
          shareIds: { $addToSet: "$_id" } // Track which shares got likes
        }
      },
      {
        $project: {
          _id: 1,
          likesReceivedInWindow: 1,
          shareCountInWindow: { $size: "$shareIds" }
        }
      }
    ]);

    // 3. Aggregation for Likes Given (Support)
    // Filter likes by likedAt (when they gave likes) - engagement during window
    const likeStats = await Share.aggregate([
      { $match: { group: gid } }, // All shares in group
      { $unwind: "$likes" },
      { $match: { 'likes.likedAt': dateFilter } },
      { $group: { _id: "$likes.user", likesGiven: { $sum: 1 } } }
    ]);

    // Map stats for lookup
    const statsMap = {};
    shareStats.forEach(s => {
      statsMap[s._id.toString()] = {
        ...s,
        varietyCount: s.uniqueArtists.length,
        avgLikesReceived: 0 // Initialize to 0, will be updated by popularity stats if applicable
      };
    });

    // Merge popularity stats (Option A: engagement during window)
    popularityStats.forEach(p => {
      const userId = p._id.toString();
      if (!statsMap[userId]) {
        statsMap[userId] = { shareCount: 0, varietyCount: 0, lastSharedAt: null, avgLikesReceived: 0 };
      }
      statsMap[userId].likesReceivedInWindow = p.likesReceivedInWindow || 0;
      statsMap[userId].shareCountInWindow = p.shareCountInWindow || 0;
      // Calculate average: likes received in window / shares that got likes in window
      statsMap[userId].avgLikesReceived = p.shareCountInWindow > 0 
        ? (p.likesReceivedInWindow / p.shareCountInWindow) 
        : 0;
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
      const s = statsMap[mid] || { shareCount: 0, varietyCount: 0, lastSharedAt: null };
      const likesGiven = supportMap[mid] || 0;
      
      // Ensure avgLikesReceived is always a number
      const avgLikesReceived = (s.avgLikesReceived !== undefined && s.avgLikesReceived !== null) 
        ? Number(s.avgLikesReceived) 
        : 0;

      // Calculate Scores (0-100)

      // Activity: Raw share count vs max
      const activityScore = maxActivity > 0 ? Math.round((s.shareCount / maxActivity) * 100) : 0;

      // Popularity: Avg likes per share vs max
      const popularityScore = maxPopularity > 0 ? Math.round((avgLikesReceived / maxPopularity) * 100) : 0;

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
          shares: s.shareCount || 0,
          likesGiven,
          avgLikesReceived: avgLikesReceived.toFixed(1)
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

  /**
   * Get Taste Gravity analytics
   * Visualizes the "social pull" between group members based on shared musical taste
   * @param {string} groupId - Group ID
   * @param {string} timeRange - '7d' | '30d' | '90d' | 'all'
   * @returns {Promise<Object>} Graph data with nodes, links, and insights
   */
  static async getTasteGravity(groupId, timeRange = '7d') {
    const gid = new mongoose.Types.ObjectId(groupId);
    const now = new Date();
    let startDate = new Date();

    // Calculate start date based on timeRange
    if (timeRange === '7d') {
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
      const earliest = await Share.findOne({ group: gid })
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
      // Default to 7d
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 7,
        0, 0, 0, 0
      ));
    }

    // Get group with members
    const group = await Group.findById(gid).populate('members', 'displayName profileImage').lean();
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.members.length < 2) {
      // Return empty graph for single-member or empty groups
      return {
        nodes: group.members.map(m => ({
          id: m._id.toString(),
          name: m.displayName,
          img: m.profileImage || null,
          mass: 0,
          topArtists: []
        })),
        links: [],
        insights: ['Not enough members to calculate taste gravity']
      };
    }

    const memberIds = group.members.map(m => new mongoose.Types.ObjectId(m._id));

    // Get all shares in time range with listeners and likes
    const shares = await Share.find({
      group: gid,
      createdAt: { $gte: startDate }
    })
      .select('artistName listeners likes')
      .lean();

    // Build per-user artist frequency maps from listens
    const userArtistCounts = new Map(); // userId -> { artistName: count }
    const userListenedShares = new Map(); // userId -> Set of share IDs
    const userLikedShares = new Map(); // userId -> Set of share IDs
    const artistUserCounts = new Map(); // artistName -> count of users who listened

    // Initialize maps for all members
    memberIds.forEach(id => {
      userArtistCounts.set(id.toString(), new Map());
      userListenedShares.set(id.toString(), new Set());
      userLikedShares.set(id.toString(), new Set());
    });

    // Process shares to build frequency maps
    shares.forEach(share => {
      const shareId = share._id.toString();
      const artistName = share.artistName;

      // Process listeners
      if (share.listeners && Array.isArray(share.listeners)) {
        share.listeners.forEach(listener => {
          const userId = listener.user?.toString();
          if (userId && memberIds.some(id => id.toString() === userId)) {
            const counts = userArtistCounts.get(userId);
            if (counts) {
              counts.set(artistName, (counts.get(artistName) || 0) + 1);
              userListenedShares.get(userId).add(shareId);
              
              // Track which users listened to this artist
              if (!artistUserCounts.has(artistName)) {
                artistUserCounts.set(artistName, new Set());
              }
              artistUserCounts.get(artistName).add(userId);
            }
          }
        });
      }

      // Process likes
      if (share.likes && Array.isArray(share.likes)) {
        share.likes.forEach(like => {
          const userId = like.user?.toString();
          if (userId && memberIds.some(id => id.toString() === userId)) {
            userLikedShares.get(userId)?.add(shareId);
          }
        });
      }
    });

    const totalUsers = memberIds.length;

    // Calculate TF-IDF vectors for each user
    const userVectors = new Map(); // userId -> Map(artistName -> tfidf)
    const allArtists = new Set();

    userArtistCounts.forEach((counts, userId) => {
      counts.forEach((count, artist) => {
        allArtists.add(artist);
      });
    });

    // Calculate IDF for each artist
    const artistIdf = new Map();
    allArtists.forEach(artist => {
      const usersWhoListened = artistUserCounts.get(artist)?.size || 0;
      const idf = Math.log(1 + totalUsers / (1 + usersWhoListened));
      artistIdf.set(artist, idf);
    });

    // Build TF-IDF vectors
    userArtistCounts.forEach((counts, userId) => {
      const vector = new Map();
      let totalListens = 0;
      counts.forEach(count => {
        totalListens += count;
      });

      counts.forEach((count, artist) => {
        const tf = count; // Term frequency (raw count)
        const idf = artistIdf.get(artist) || 0;
        const tfidf = tf * idf;
        vector.set(artist, tfidf);
      });

      userVectors.set(userId, vector);
    });

    // Helper: Cosine similarity between two vectors
    const cosineSimilarity = (vecA, vecB) => {
      const allKeys = new Set([...vecA.keys(), ...vecB.keys()]);
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      allKeys.forEach(key => {
        const valA = vecA.get(key) || 0;
        const valB = vecB.get(key) || 0;
        dotProduct += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
      });

      const denominator = Math.sqrt(normA) * Math.sqrt(normB);
      return denominator === 0 ? 0 : dotProduct / denominator;
    };

    // Helper: Jaccard similarity (for co-listening and co-liking)
    const jaccardSimilarity = (setA, setB) => {
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return union.size === 0 ? 0 : intersection.size / union.size;
    };

    // Helper: Clamp value to [0, 1]
    const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

    // Calculate gravity between all pairs
    const links = [];
    const userLinkMap = new Map(); // userId -> array of links (for top 3 guarantee)

    for (let i = 0; i < memberIds.length; i++) {
      const userIdA = memberIds[i].toString();
      const linkArray = [];
      userLinkMap.set(userIdA, linkArray);

      for (let j = i + 1; j < memberIds.length; j++) {
        const userIdB = memberIds[j].toString();

        // Calculate artist cosine similarity
        const vecA = userVectors.get(userIdA) || new Map();
        const vecB = userVectors.get(userIdB) || new Map();
        const artistCosine = cosineSimilarity(vecA, vecB);

        // Calculate co-listening overlap
        const listenedA = userListenedShares.get(userIdA) || new Set();
        const listenedB = userListenedShares.get(userIdB) || new Set();
        const coListenOverlap = jaccardSimilarity(listenedA, listenedB);

        // Calculate co-liking overlap
        const likedA = userLikedShares.get(userIdA) || new Set();
        const likedB = userLikedShares.get(userIdB) || new Set();
        const coLikeOverlap = jaccardSimilarity(likedA, likedB);

        // Calculate gravity
        const gravity = clamp01(0.65 * artistCosine + 0.30 * coListenOverlap + 0.05 * coLikeOverlap);

        // Build reasons array
        const reasons = [];
        if (artistCosine > 0.1) {
          // Find shared artists
          const sharedArtists = [];
          vecA.forEach((val, artist) => {
            if (vecB.has(artist) && val > 0 && vecB.get(artist) > 0) {
              sharedArtists.push(artist);
            }
          });
          if (sharedArtists.length > 0) {
            const topShared = sharedArtists
              .sort((a, b) => {
                const scoreA = (vecA.get(a) || 0) + (vecB.get(a) || 0);
                const scoreB = (vecA.get(b) || 0) + (vecB.get(b) || 0);
                return scoreB - scoreA;
              })
              .slice(0, 3);
            reasons.push(`Shared Artists: ${topShared.join(', ')}`);
          }
        }
        if (coListenOverlap > 0.1) {
          reasons.push(`Co-listened ${Math.round(coListenOverlap * 100)}% of tracks`);
        }
        if (coLikeOverlap > 0.1) {
          reasons.push(`Co-liked ${Math.round(coLikeOverlap * 100)}% of tracks`);
        }

        const link = {
          source: userIdA,
          target: userIdB,
          gravity,
          reasons: reasons.length > 0 ? reasons : ['Low similarity']
        };

        links.push(link);
        linkArray.push(link);
      }
    }

    // Filter links by threshold (0.08) but ensure top 3 per user
    const threshold = 0.08;
    const filteredLinks = links.filter(link => link.gravity >= threshold);

    // Ensure each user has at least top 3 strongest links
    const finalLinks = new Set();
    filteredLinks.forEach(link => {
      finalLinks.add(JSON.stringify([link.source, link.target, link.gravity].sort()));
    });

    userLinkMap.forEach((linkArray, userId) => {
      // Sort by gravity descending
      linkArray.sort((a, b) => b.gravity - a.gravity);
      // Add top 3
      linkArray.slice(0, 3).forEach(link => {
        const key = JSON.stringify([link.source, link.target, link.gravity].sort());
        finalLinks.add(key);
      });
    });

    // Reconstruct final links array
    const finalLinksArray = links.filter(link => {
      const key = JSON.stringify([link.source, link.target, link.gravity].sort());
      return finalLinks.has(key);
    });

    // Calculate user mass
    const userMass = new Map();
    memberIds.forEach(id => {
      const userId = id.toString();
      const listenedCount = userListenedShares.get(userId)?.size || 0;
      const likedCount = userLikedShares.get(userId)?.size || 0;
      const mass = Math.log(1 + listenedCount) + 0.5 * Math.log(1 + likedCount);
      userMass.set(userId, mass);
    });

    // Normalize mass to [0, 1] range
    const maxMass = Math.max(...Array.from(userMass.values()), 1);
    userMass.forEach((mass, userId) => {
      userMass.set(userId, mass / maxMass);
    });

    // Build nodes
    const nodes = group.members.map(member => {
      const userId = member._id.toString();
      const counts = userArtistCounts.get(userId) || new Map();
      const topArtists = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([artist]) => artist);

      return {
        id: userId,
        name: member.displayName,
        img: member.profileImage || null,
        mass: userMass.get(userId) || 0,
        topArtists
      };
    });

    // Generate insights
    const insights = [];
    if (finalLinksArray.length > 0) {
      // Find strongest connection
      const strongest = finalLinksArray.reduce((max, link) => 
        link.gravity > max.gravity ? link : max
      );
      const nodeA = nodes.find(n => n.id === strongest.source);
      const nodeB = nodes.find(n => n.id === strongest.target);
      if (nodeA && nodeB && strongest.reasons.length > 0) {
        insights.push(
          `The strongest pull is between ${nodeA.name} and ${nodeB.name} due to ${strongest.reasons[0].toLowerCase()}`
        );
      }

      // Count connections
      const avgGravity = finalLinksArray.reduce((sum, link) => sum + link.gravity, 0) / finalLinksArray.length;
      insights.push(
        `${finalLinksArray.length} connections found with average gravity of ${(avgGravity * 100).toFixed(1)}%`
      );
    } else {
      insights.push('No strong connections found. Members may have different musical tastes.');
    }

    return {
      nodes,
      links: finalLinksArray,
      insights
    };
  }

  /**
   * Compute Listener Reflex analytics
   * Tracks how quickly group members react to shared songs
   * @param {string} groupId - Group ID
   * @param {string} range - Time range: '24h' | '7d' | '30d' | '90d'
   * @param {string} mode - Analysis mode: 'received' | 'shared'
   *   - 'received': How fast each member listens to songs shared in the group
   *   - 'shared': How fast others listen to songs shared by that member
   */
  static async computeListenerReflex(groupId, range = '30d', mode = 'received') {
    const gid = new mongoose.Types.ObjectId(groupId);
    const now = new Date();
    let startDate = new Date();

    // Calculate start date based on range
    if (range === '24h') {
      startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (range === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (range === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else {
      // Default to 30d
      startDate.setDate(now.getDate() - 30);
    }

    // Get group members
    const group = await Group.findById(gid).select('members').lean();
    if (!group) {
      throw new Error('Group not found');
    }

    const memberIds = group.members.map(m => new mongoose.Types.ObjectId(m));

    // Build aggregation pipeline based on mode
    let pipeline;

    if (mode === 'received') {
      // Received mode: How fast each member listens to songs shared in the group
      pipeline = [
        {
          $match: {
            group: gid,
            createdAt: { $gte: startDate }
          }
        },
        { $unwind: '$listeners' },
        {
          $match: {
            'listeners.user': { $in: memberIds },
            'listeners.timeToListen': { $ne: null, $exists: true },
            'listeners.listenedAt': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$listeners.user',
            listenData: {
              $push: {
                ms: '$listeners.timeToListen',
                listenedAt: '$listeners.listenedAt'
              }
            },
            count: { $sum: 1 }
          }
        }
      ];
    } else {
      // Shared mode: How fast others listen to songs shared by that member
      pipeline = [
        {
          $match: {
            group: gid,
            sharedBy: { $in: memberIds },
            createdAt: { $gte: startDate }
          }
        },
        { $unwind: '$listeners' },
        {
          $match: {
            'listeners.timeToListen': { $ne: null, $exists: true },
            'listeners.listenedAt': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$sharedBy',
            listenData: {
              $push: {
                ms: '$listeners.timeToListen',
                listenedAt: '$listeners.listenedAt'
              }
            },
            count: { $sum: 1 }
          }
        }
      ];
    }

    // Execute aggregation
    const aggregationResults = await Share.aggregate(pipeline);

    // Helper function to calculate percentile
    const calculatePercentile = (values, percentile) => {
      if (!values || values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      
      // For median (50th percentile), handle even/odd cases correctly
      if (percentile === 50) {
        const mid = sorted.length / 2;
        if (sorted.length % 2 === 0) {
          // Even number of values: average the two middle values
          return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
          // Odd number of values: return the middle value
          return sorted[Math.floor(mid)];
        }
      }
      
      // For other percentiles, use the standard formula
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    // Process results and calculate statistics
    const userStatsMap = new Map();

    for (const result of aggregationResults) {
      const userId = result._id.toString();
      // Filter out invalid entries and extract timeToListen values for statistics
      const validListenData = result.listenData.filter(
        item => item.ms !== null && item.ms !== undefined && item.listenedAt
      );

      if (validListenData.length === 0) continue;

      // Extract timeToListen values for statistics calculation
      const timeToListenValues = validListenData.map(item => item.ms);

      // Calculate statistics
      const sorted = [...timeToListenValues].sort((a, b) => a - b);
      const median = calculatePercentile(sorted, 50);
      const p25 = calculatePercentile(sorted, 25);
      const p75 = calculatePercentile(sorted, 75);
      const avg = timeToListenValues.reduce((sum, val) => sum + val, 0) / timeToListenValues.length;

      // Categorize based on median
      let category;
      if (median < 600000) { // < 10 minutes
        category = 'instant';
      } else if (median < 3600000) { // 10-60 minutes
        category = 'quick';
      } else if (median < 86400000) { // 1-24 hours
        category = 'slow';
      } else { // > 24 hours
        category = 'longTail';
      }

      // Store listenData with both ms and listenedAt for ringData
      // Sort by listenedAt (most recent first) for ringData, then limit to 50
      const sortedByRecency = [...validListenData].sort((a, b) => {
        const dateA = new Date(a.listenedAt).getTime();
        const dateB = new Date(b.listenedAt).getTime();
        return dateB - dateA; // Most recent first
      });

      userStatsMap.set(userId, {
        userId,
        listens: timeToListenValues.length,
        medianMs: median,
        p25Ms: p25,
        p75Ms: p75,
        avgMs: avg,
        category,
        listenData: sortedByRecency // Keep with timestamps for ringData
      });
    }

    // Get user details for all users with stats
    const userIds = Array.from(userStatsMap.keys()).map(id => new mongoose.Types.ObjectId(id));
    const users = await User.find({ _id: { $in: userIds } })
      .select('displayName profileImage')
      .lean();

    const userDetailsMap = new Map();
    users.forEach(user => {
      userDetailsMap.set(user._id.toString(), {
        displayName: user.displayName,
        avatarUrl: user.profileImage || null
      });
    });

    // Build users array with details
    const usersArray = [];
    const buckets = {
      instant: [],
      quick: [],
      slow: [],
      longTail: []
    };

    for (const [userId, stats] of userStatsMap.entries()) {
      const userDetails = userDetailsMap.get(userId);
      if (!userDetails) continue;

      usersArray.push({
        userId,
        displayName: userDetails.displayName,
        avatarUrl: userDetails.avatarUrl,
        listens: stats.listens,
        medianMs: stats.medianMs,
        p25Ms: stats.p25Ms,
        p75Ms: stats.p75Ms,
        category: stats.category
      });

      buckets[stats.category].push(userId);
    }

    // Sort users by median time (fastest first)
    usersArray.sort((a, b) => a.medianMs - b.medianMs);

    // Build ringData (sample up to 50 most recent points per user)
    const ringData = [];
    for (const [userId, stats] of userStatsMap.entries()) {
      // Take up to 50 most recent listens (already sorted by recency)
      const recentListens = stats.listenData.slice(0, 50);
      const points = recentListens.map(item => ({
        ms: item.ms,
        listenedAt: item.listenedAt instanceof Date 
          ? item.listenedAt.toISOString() 
          : new Date(item.listenedAt).toISOString()
      }));
      
      ringData.push({
        userId,
        points
      });
    }

    // Calculate group median
    const allMedians = usersArray.map(u => u.medianMs);
    const groupMedianMs = allMedians.length > 0
      ? calculatePercentile(allMedians, 50)
      : null;

    // Build summary
    const summary = {
      groupMedianMs: groupMedianMs || 0,
      instantReactorCount: buckets.instant.length
    };

    return {
      groupId: groupId.toString(),
      range,
      mode,
      generatedAt: new Date().toISOString(),
      buckets,
      users: usersArray,
      ringData,
      summary
    };
  }

  /**
   * Compute Listener Reflex Radar Profiles
   * Calculates 5-axis radar profiles (Speed, Consistency, Recency, Volume, Burstiness) for group members
   * @param {string} groupId - Group ID
   * @param {string} timeWindow - Time window: '7d' | '30d' | '90d' | 'all'
   * @param {string} mode - Analysis mode: 'received' | 'shared'
   * @returns {Promise<Object>} Radar profiles for all members
   */
  static async computeListenerReflexRadar(groupId, timeWindow = '30d', mode = 'received') {
    const gid = new mongoose.Types.ObjectId(groupId);
    const now = new Date();
    let startDate = new Date();

    // Calculate start date based on timeWindow
    if (timeWindow === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeWindow === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeWindow === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeWindow === 'all') {
      // For 'all', use earliest share or cap to 90 days for performance
      const earliest = await Share.findOne({ group: gid })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean();
      
      if (earliest?.createdAt) {
        startDate = new Date(earliest.createdAt);
        const days = (now.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
        if (days > 90) {
          startDate.setDate(now.getDate() - 90);
        }
      } else {
        startDate.setDate(now.getDate() - 90);
      }
    } else {
      // Default to 30d
      startDate.setDate(now.getDate() - 30);
    }

    // Calculate maxLatencySeconds (cap at 90 days for 'all' or use timeWindow duration)
    let maxLatencySeconds;
    if (timeWindow === 'all') {
      maxLatencySeconds = 90 * 24 * 60 * 60; // 90 days in seconds
    } else if (timeWindow === '7d') {
      maxLatencySeconds = 7 * 24 * 60 * 60;
    } else if (timeWindow === '30d') {
      maxLatencySeconds = 30 * 24 * 60 * 60;
    } else if (timeWindow === '90d') {
      maxLatencySeconds = 90 * 24 * 60 * 60;
    } else {
      maxLatencySeconds = 30 * 24 * 60 * 60; // Default 30 days
    }

    // Get group members
    const group = await Group.findById(gid).select('members').lean();
    if (!group) {
      throw new Error('Group not found');
    }

    const memberIds = group.members.map(m => new mongoose.Types.ObjectId(m));

    // Build aggregation pipeline to get share and listen data
    let pipeline;
    if (mode === 'received') {
      // Received mode: How fast each member listens to songs shared in the group
      pipeline = [
        {
          $match: {
            group: gid,
            createdAt: { $gte: startDate }
          }
        },
        { $unwind: '$listeners' },
        {
          $match: {
            'listeners.user': { $in: memberIds },
            'listeners.timeToListen': { $ne: null, $exists: true },
            'listeners.listenedAt': { $exists: true }
          }
        },
        {
          $project: {
            listenerId: '$listeners.user',
            sharerId: '$sharedBy',
            sharedAt: '$createdAt',
            listenedAt: '$listeners.listenedAt',
            timeToListenMs: '$listeners.timeToListen'
          }
        }
      ];
    } else {
      // Shared mode: How fast others listen to songs shared by that member
      pipeline = [
        {
          $match: {
            group: gid,
            sharedBy: { $in: memberIds },
            createdAt: { $gte: startDate }
          }
        },
        { $unwind: '$listeners' },
        {
          $match: {
            'listeners.timeToListen': { $ne: null, $exists: true },
            'listeners.listenedAt': { $exists: true }
          }
        },
        {
          $project: {
            listenerId: '$listeners.user',
            sharerId: '$sharedBy',
            sharedAt: '$createdAt',
            listenedAt: '$listeners.listenedAt',
            timeToListenMs: '$listeners.timeToListen'
          }
        }
      ];
    }

    // Execute aggregation
    const reactions = await Share.aggregate(pipeline);

    // Process reactions: calculate latencySeconds and group by member
    const memberReactionsMap = new Map();

    for (const reaction of reactions) {
      const memberId = mode === 'received' 
        ? reaction.listenerId.toString() 
        : reaction.sharerId.toString();
      
      if (!memberReactionsMap.has(memberId)) {
        memberReactionsMap.set(memberId, []);
      }

      const sharedAt = new Date(reaction.sharedAt);
      const listenedAt = new Date(reaction.listenedAt);
      const latencySeconds = Math.max(0, (listenedAt.getTime() - sharedAt.getTime()) / 1000);

      memberReactionsMap.get(memberId).push({
        latencySeconds,
        listenedAt: listenedAt
      });
    }

    // Calculate radar profiles for each member
    const memberProfiles = [];
    const allLatencies = [];
    const allIQRs = [];
    const allReactionCounts = [];
    const allCVs = [];

    // First pass: collect all metrics for normalization
    for (const [userId, reactions] of memberReactionsMap.entries()) {
      if (reactions.length === 0) continue;

      const latencies = reactions.map(r => r.latencySeconds);
      allLatencies.push(...latencies);
      
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p25 = this.percentile(sortedLatencies, 25) || 0;
      const p75 = this.percentile(sortedLatencies, 75) || 0;
      const iqr = p75 - p25;
      allIQRs.push(iqr);

      allReactionCounts.push(reactions.length);

      // Calculate burstiness (CV of gaps between listenedAt timestamps)
      if (reactions.length >= 2) {
        const sortedListenedAt = [...reactions]
          .map(r => r.listenedAt.getTime())
          .sort((a, b) => a - b);
        
        const gaps = [];
        for (let i = 1; i < sortedListenedAt.length; i++) {
          gaps.push((sortedListenedAt[i] - sortedListenedAt[i - 1]) / 1000); // Convert to seconds
        }
        
        if (gaps.length >= 2) {
          const meanGap = this.mean(gaps);
          const stdGap = this.std(gaps);
          const cv = meanGap > 0 ? stdGap / meanGap : 0;
          allCVs.push(cv);
        }
      }
    }

    // Calculate max values for normalization
    const maxIQR = allIQRs.length > 0 ? Math.max(...allIQRs) : maxLatencySeconds;
    const maxReactionCount = allReactionCounts.length > 0 ? Math.max(...allReactionCounts) : 1;
    const maxCV = allCVs.length > 0 ? Math.max(...allCVs) : 2.0;

    // Second pass: calculate axes for each member
    for (const [userId, reactions] of memberReactionsMap.entries()) {
      if (reactions.length === 0) continue;

      const latencies = reactions.map(r => r.latencySeconds);
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      
      const medianLatency = this.median(sortedLatencies) || 0;
      const p25 = this.percentile(sortedLatencies, 25) || 0;
      const p75 = this.percentile(sortedLatencies, 75) || 0;
      const iqr = p75 - p25;
      const reactionCount = reactions.length;

      // 1. Speed axis (0-100, higher = faster)
      const speed = 100 * (1 - this.logNormalize(medianLatency, maxLatencySeconds));

      // 2. Consistency axis (0-100, higher = more predictable)
      const consistency = 100 * (1 - this.logNormalize(iqr, maxIQR));

      // 3. Recency Bias axis (0-100, higher = reacts to new shares)
      const freshnessValues = latencies.map(latency => 
        this.clamp(1 - latency / maxLatencySeconds, 0, 1)
      );
      const recency = 100 * this.mean(freshnessValues);

      // 4. Engagement Volume axis (0-100, higher = reacts more)
      const volume = 100 * this.logNormalize(reactionCount, maxReactionCount);

      // 5. Burstiness axis (0-100, higher = reacts in streaks)
      let burstiness = 0;
      if (reactions.length >= 2) {
        const sortedListenedAt = [...reactions]
          .map(r => r.listenedAt.getTime())
          .sort((a, b) => a - b);
        
        const gaps = [];
        for (let i = 1; i < sortedListenedAt.length; i++) {
          gaps.push((sortedListenedAt[i] - sortedListenedAt[i - 1]) / 1000);
        }
        
        if (gaps.length >= 2) {
          const meanGap = this.mean(gaps);
          const stdGap = this.std(gaps);
          const cv = meanGap > 0 ? stdGap / meanGap : 0;
          burstiness = 100 * this.clamp(cv / maxCV, 0, 1);
        }
      }

      // Mark as low data if reactionCount < 3
      const lowData = reactionCount < 3;

      memberProfiles.push({
        userId,
        axes: {
          speed: Math.round(speed),
          consistency: Math.round(consistency),
          recency: Math.round(recency),
          volume: Math.round(volume),
          burstiness: Math.round(burstiness)
        },
        raw: {
          reactionCount,
          medianLatencySeconds: Math.round(medianLatency),
          iqrSeconds: Math.round(iqr)
        },
        lowData
      });
    }

    // Get user details
    const userIds = memberProfiles.map(p => new mongoose.Types.ObjectId(p.userId));
    const users = await User.find({ _id: { $in: userIds } })
      .select('displayName profileImage')
      .lean();

    const userDetailsMap = new Map();
    users.forEach(user => {
      userDetailsMap.set(user._id.toString(), {
        displayName: user.displayName,
        avatarUrl: user.profileImage || null
      });
    });

    // Add user details to profiles
    const members = memberProfiles.map(profile => {
      const userDetails = userDetailsMap.get(profile.userId) || {
        displayName: 'Unknown',
        avatarUrl: null
      };
      
      return {
        ...profile,
        displayName: userDetails.displayName,
        avatarUrl: userDetails.avatarUrl
      };
    });

    return {
      window: timeWindow,
      mode,
      maxLatencySeconds,
      members
    };
  }
}

module.exports = AnalyticsService;
