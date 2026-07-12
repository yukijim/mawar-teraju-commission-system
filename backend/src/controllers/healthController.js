const healthService = require('../services/healthService');

/**
 * Controller class for handling system health diagnosis endpoint.
 */
class HealthController {
  /**
   * GET /api/health
   * Retrieves overall backend status and PostgreSQL connection state.
   */
  getHealth = async (req, res, next) => {
    try {
      const healthStatus = await healthService.getHealthStatus();
      
      const payload = {
        status: healthStatus.databaseConnected ? 'ok' : 'error',
        database: healthStatus.databaseConnected ? 'connected' : 'disconnected',
        version: healthStatus.version,
      };

      const statusCode = healthStatus.databaseConnected ? 200 : 503;
      return res.status(statusCode).json(payload);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new HealthController();
