const dashboardService = require('../services/dashboardService');
const { sendResponse } = require('../utils/response');

/**
 * Controller coordinating Admin dashboard summary, database backups, and health metrics.
 */
class DashboardController {
  /**
   * GET /api/v1/dashboard/summary
   * Fetches monthly totals and payment payouts trends.
   */
  getSummary = async (req, res, next) => {
    try {
      const metrics = await dashboardService.getSummary(req.user, req);
      return sendResponse(res, 200, true, 'Dashboard summary retrieved successfully.', metrics);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/admin/backup
   * Compiles data and streams custom SQL table insertion backups.
   */
  downloadBackup = async (req, res, next) => {
    try {
      const { filename, sqlDump } = await dashboardService.generateDatabaseBackup(req.user, req);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.end(sqlDump);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/monitor
   * Fetches performance and connection health indicators.
   */
  getMonitorMetrics = async (req, res, next) => {
    try {
      const diagnostics = await dashboardService.getSystemMonitoringMetrics(req.user, req);
      return sendResponse(res, 200, true, 'System diagnostic metrics retrieved successfully.', diagnostics);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DashboardController();
