const AnalyticsService = require('../services/analyticsService');

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
      const { timeRange, mode } = req.query; // mode: 'shares' | 'engagement' (default: 'shares')
      const data = await AnalyticsService.getGroupActivity(id, timeRange, mode);

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
      const { timeRange } = req.query; // '24h' | '7d' | '30d' | '90d' | 'all'
      const data = await AnalyticsService.getMemberVibes(id, timeRange || 'all');

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
   * GET /api/v1/groups/:id/analytics/superlatives
   */
  static async getSuperlatives(req, res, next) {
    try {
      const { id } = req.params;
      const data = await AnalyticsService.getSuperlatives(id);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnalyticsController;
