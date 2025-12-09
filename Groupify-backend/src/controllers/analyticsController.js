const AnalyticsService = require('../services/analyticsService');

/**
 * Analytics Controller
 * Handles HTTP requests for group analytics
 */
class AnalyticsController {

  /**
   * Get group activity (waveform data)
   * GET /api/v1/groups/:id/analytics/activity
   */
  static async getGroupActivity(req, res, next) {
    try {
      const { id } = req.params;
      const { timeRange } = req.query; // '24h' or '7d'
      const data = await AnalyticsService.getGroupActivity(id, timeRange);

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
   * GET /api/v1/groups/:id/analytics/vibes
   */
  static async getMemberVibes(req, res, next) {
    try {
      const { id } = req.params;
      const data = await AnalyticsService.getMemberVibes(id);

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
