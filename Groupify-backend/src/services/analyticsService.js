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
}

module.exports = AnalyticsService;
