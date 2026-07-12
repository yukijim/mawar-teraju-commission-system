const healthRepository = require('../repositories/healthRepository');

/**
 * Service layer containing the business logic for system diagnostics.
 */
class HealthService {
  /**
   * Orchestrates the verification process for checking overall system health
   * @returns {Promise<{databaseConnected: boolean, version: string}>}
   */
  async getHealthStatus() {
    const databaseConnected = await healthRepository.checkConnection();
    
    return {
      databaseConnected,
      version: '1.0.0',
    };
  }
}

module.exports = new HealthService();
