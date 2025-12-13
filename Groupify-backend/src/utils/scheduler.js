const cron = require('node-cron');
const User = require('../models/User');
const Share = require('../models/Share');
const SpotifyService = require('../services/spotifyService');
const TokenManager = require('../utils/tokenManager');

/**
 * Scheduler Utility
 * Handles periodic tasks like polling Spotify for listening activity
 */

// Store last checked timestamps per user
const userLastChecked = new Map();

/**
 * Check for listening activity and update shares
 */
async function checkListeningActivity() {
  try {
    // Get all active users
    const users = await User.find({ isActive: true });

    for (const user of users) {
      try {
        // Get valid access token
        const accessToken = await TokenManager.getValidAccessToken(user._id.toString());

        // Get timestamp of last check (or 24 hours ago if first check)
        const lastChecked = userLastChecked.get(user._id.toString()) || 
          new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Poll Spotify for recently played tracks
        const recentlyPlayed = await SpotifyService.getRecentlyPlayed(
          accessToken,
          50,
          Math.floor(lastChecked.getTime())
        );

        // Update last checked timestamp
        userLastChecked.set(user._id.toString(), new Date());

        if (!recentlyPlayed.items || recentlyPlayed.items.length === 0) {
          continue;
        }

        // Check each recently played track against shared songs in user's groups
        const userGroups = user.groups || [];
        
        for (const playedItem of recentlyPlayed.items) {
          const trackId = playedItem.track.id;
          const playedAt = new Date(playedItem.played_at);

          // Find shares in user's groups that match this track
          const matchingShares = await Share.find({
            group: { $in: userGroups },
            spotifyTrackId: trackId,
            'listeners.user': { $ne: user._id } // Not already listened
          });

          for (const share of matchingShares) {
            // Calculate time to listen
            const shareTime = new Date(share.createdAt);
            const timeToListen = playedAt.getTime() - shareTime.getTime();

            // Only record if listened after the share was created
            if (timeToListen >= 0) {
              share.listeners.push({
                user: user._id,
                listenedAt: playedAt,
                timeToListen: timeToListen
              });
              share.listenCount += 1;
              await share.save();

              // Emit socket event for real-time updates
              // Note: You'll need to pass the io instance to this function or store it globally
            }
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Error checking activity for user ${user._id}:`, error.message);
        // Continue with other users
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in listening activity check:', error.message);
  }
}

/**
 * Initialize and start scheduled tasks
 * @param {Object} io - Socket.io instance (optional, for real-time updates)
 */
function startScheduler(io = null) {
  // Run every 5 minutes
  // Cron syntax: '*/5 * * * *' means "every 5 minutes"
  // Adjust as needed - Spotify API has rate limits, so don't poll too frequently
  cron.schedule('*/5 * * * *', async () => {
    await checkListeningActivity();
  });

  // Also run immediately on startup (optional)
  // Uncomment if you want to check on server start
  // checkListeningActivity();
}

/**
 * Stop scheduled tasks (for graceful shutdown)
 */
function stopScheduler() {
  // node-cron doesn't have a direct stop method, but tasks can be stopped
  // by storing the task and calling .destroy() if needed
}

module.exports = {
  startScheduler,
  stopScheduler,
  checkListeningActivity
};

