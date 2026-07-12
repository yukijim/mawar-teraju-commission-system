const db = require('../config/database');

/**
 * Repository layer for checking PostgreSQL health.
 */
class HealthRepository {
  /**
   * Verify database connection by executing a simple query
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (err) {
      console.error('[HealthRepository Database Error]', err.message);
      return false;
    }
  }
}

module.exports = new HealthRepository();
