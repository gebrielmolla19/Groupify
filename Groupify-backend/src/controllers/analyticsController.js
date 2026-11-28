const AnalyticsService = require('../services/analyticsService');
const geminiService = require('../services/geminiService');
const {
  VIEWER_SUMMARY_RANGES,
  getViewerSummary,
  isValidTimeZone
} = require('../services/viewerSummaryService');
const { getSongsSummary } = require('../services/songsSummaryService');
const logger = require('../utils/logger');

// Hall of Fame periods; the page's shared range control offers the same three.
const SUPERLATIVE_RANGES = ['7d', '30d', 'all'];

/**
 * Analytics Controller
 * Handles HTTP requests for group analytics
 */
class AnalyticsController {

  /**
   * Get group activity (waveform data)
   * GET /api/v1/groups/:id/analytics/activity?timeRange=30d&mode=engagement
   */
  static async getGroupActivity(req, res, next) {
    try {
      const { id } = req.params;
      const { timeRange, mode } = req.query;
      const data = await AnalyticsService.getGroupActivity(id, timeRange, mode);

      logger.debug('[Analytics] Group activity fetched', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId: id,
        timeRange,
        mode
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get member vibes (Vibe Radar)
   * GET /api/v1/groups/:id/analytics/vibes?timeRange=30d
   */
  static async getMemberVibes(req, res, next) {
    try {
      const { id } = req.params;
      const { timeRange } = req.query;
      const data = await AnalyticsService.getMemberVibes(id, timeRange || 'all');

      logger.debug('[Analytics] Member vibes fetched', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId: id,
        timeRange: timeRange || 'all'
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get superlatives (Hall of Fame)
   * GET /api/v1/groups/:id/analytics/superlatives?timeRange=30d (default all)
   */
  static async getSuperlatives(req, res, next) {
    try {
      const { id } = req.params;
      const { timeRange = 'all' } = req.query;

      if (!SUPERLATIVE_RANGES.includes(timeRange)) {
        return res.status(400).json({
          success: false,
          message: `Invalid timeRange. Must be one of: ${SUPERLATIVE_RANGES.join(', ')}`
        });
      }

      const data = await AnalyticsService.getSuperlatives(id, timeRange);

      logger.debug('[Analytics] Superlatives fetched', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId: id,
        timeRange
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get taste gravity analytics
   * GET /api/v1/groups/:id/analytics/taste-gravity?timeRange=7d
   */
  static async getTasteGravity(req, res, next) {
    try {
      const { id } = req.params;
      const { timeRange = '7d' } = req.query;

      const validRanges = ['7d', '30d', 'all'];
      if (!validRanges.includes(timeRange)) {
        logger.warn('[Analytics] Invalid timeRange for taste gravity', {
          userId: req.userId,
          groupId: id,
          provided: timeRange,
          valid: validRanges
        });

        return res.status(400).json({
          success: false,
          message: `Invalid timeRange. Must be one of: ${validRanges.join(', ')}`
        });
      }

      const data = await AnalyticsService.getTasteGravity(id, timeRange);

      logger.debug('[Analytics] Taste gravity fetched', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId: id,
        timeRange
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get listener reflex analytics
   * GET /api/v1/analytics/:id/listener-reflex?range=30d&mode=received
   */
  static async getListenerReflex(req, res, next) {
    try {
      const { id } = req.params;
      const { range = '30d', mode = 'received' } = req.query;

      const validRanges = ['24h', '7d', '30d', 'all'];
      if (!validRanges.includes(range)) {
        logger.warn('[Analytics] Invalid range for listener reflex', {
          userId: req.userId,
          groupId: id,
          provided: range
        });

        return res.status(400).json({
          success: false,
          message: `Invalid range. Must be one of: ${validRanges.join(', ')}`
        });
      }

      const validModes = ['received', 'shared'];
      if (!validModes.includes(mode)) {
        logger.warn('[Analytics] Invalid mode for listener reflex', {
          userId: req.userId,
          groupId: id,
          provided: mode
        });

        return res.status(400).json({
          success: false,
          message: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        });
      }

      const data = await AnalyticsService.computeListenerReflex(id, range, mode);

      logger.debug('[Analytics] Listener reflex computed', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId: id,
        range,
        mode
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get listener reflex radar profiles
   * GET /api/v1/analytics/listener-reflex/radar?groupId=...&window=7d&mode=received
   */
  static async getListenerReflexRadar(req, res, next) {
    try {
      const { groupId } = req.query;
      const { window = '30d', mode = 'received' } = req.query;

      if (!groupId) {
        logger.warn('[Analytics] Missing groupId for listener reflex radar', {
          userId: req.userId
        });

        return res.status(400).json({
          success: false,
          message: 'groupId is required'
        });
      }

      const validWindows = ['7d', '30d', 'all'];
      if (!validWindows.includes(window)) {
        return res.status(400).json({
          success: false,
          message: `Invalid window. Must be one of: ${validWindows.join(', ')}`
        });
      }

      const validModes = ['received', 'shared'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        });
      }

      const data = await AnalyticsService.computeListenerReflexRadar(groupId, window, mode);

      logger.debug('[Analytics] Listener reflex radar computed', {
        userId: req.userId,
        userDisplayName: req.user?.displayName,
        groupId,
        window,
        mode
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AI-generated insights for analytics sections
   * GET /api/v1/analytics/:id/ai-insights?type=reflex&timeRange=30d&mode=received
   */
  static async getAiInsights(req, res, next) {
    try {
      const { id } = req.params;
      const { type, timeRange = '30d', mode = 'received' } = req.query;

      if (type !== 'reflex') {
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Currently supported: reflex'
        });
      }

      // Validate params (same as listener-reflex endpoint)
      const validRanges = ['24h', '7d', '30d', 'all'];
      if (!validRanges.includes(timeRange)) {
        return res.status(400).json({
          success: false,
          message: `Invalid timeRange. Must be one of: ${validRanges.join(', ')}`
        });
      }

      const validModes = ['received', 'shared'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid mode. Must be one of: ${validModes.join(', ')}`
        });
      }

      // Get the raw analytics data
      const reflexData = await AnalyticsService.computeListenerReflex(id, timeRange, mode);

      // Generate AI insights
      const insights = await geminiService.generateReflexInsights(reflexData);

      logger.debug('[Analytics] AI insights generated', {
        userId: req.userId,
        groupId: id,
        type,
        timeRange,
        mode,
        generated: insights !== null
      });

      res.json({
        success: true,
        data: {
          type,
          generated: insights !== null,
          cachedAt: new Date().toISOString(),
          insights
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * The "You" section of Group Dynamics: numbers about the signed-in member.
   * GET /api/v1/analytics/:id/you?range=30d&tz=America/New_York
   * `tz` (IANA, default UTC) decides which calendar day a share falls on.
   */
  static async getViewerSummary(req, res, next) {
    try {
      const { id } = req.params;
      const { range = '30d', tz = 'UTC' } = req.query;

      if (!VIEWER_SUMMARY_RANGES.includes(range)) {
        return res.status(400).json({
          success: false,
          message: `Invalid range. Must be one of: ${VIEWER_SUMMARY_RANGES.join(', ')}`
        });
      }
      if (typeof tz !== 'string' || !isValidTimeZone(tz)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tz. Must be an IANA time zone such as America/New_York.'
        });
      }

      const data = await getViewerSummary(id, req.group.members, req.userId, range, tz);

      logger.debug('[Analytics] Viewer summary computed', {
        userId: req.userId,
        groupId: id,
        range
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * "The songs" cards: shares the viewer is sleeping on, the viewer's shares
   * the group slept on, and group records.
   * GET /api/v1/analytics/:id/songs?range=30d&tz=America/New_York
   */
  static async getSongsSummary(req, res, next) {
    try {
      const { id } = req.params;
      const { range = '30d', tz = 'UTC' } = req.query;

      if (!VIEWER_SUMMARY_RANGES.includes(range)) {
        return res.status(400).json({
          success: false,
          message: `Invalid range. Must be one of: ${VIEWER_SUMMARY_RANGES.join(', ')}`
        });
      }
      if (typeof tz !== 'string' || !isValidTimeZone(tz)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tz. Must be an IANA time zone such as America/New_York.'
        });
      }

      const data = await getSongsSummary(id, req.group.members, req.userId, range, tz);

      logger.debug('[Analytics] Songs summary computed', { userId: req.userId, groupId: id, range });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnalyticsController;
