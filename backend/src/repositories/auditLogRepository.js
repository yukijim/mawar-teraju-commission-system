const db = require('../config/database');

/**
 * Data Access Layer for security Audit Trails.
 */
class AuditLogRepository {
  /**
   * Persists a new audit log record to the database
   * @param {object} logData
   * @param {string|null} logData.userId - UUID string of the authenticated user (or null if unauthenticated)
   * @param {string} logData.action - Action title (e.g. 'LOGIN_SUCCESS', 'LOGOUT')
   * @param {string} logData.ipAddress - Client IP address string
   * @param {string} logData.userAgent - Client User Agent string
   * @param {string} logData.status - Action status ('SUCCESS', 'FAILED')
   * @param {object|null} logData.details - Structured metadata JSON content
   * @returns {Promise<object>}
   */
  async createLog({ userId, action, ipAddress, userAgent, status, details }) {
    const text = `
      INSERT INTO audit_logs (user_id, action, ip_address, user_agent, status, details)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      userId || null,
      action,
      ipAddress || 'unknown',
      userAgent || 'unknown',
      status,
      details ? JSON.stringify(details) : null,
    ];
    const result = await db.query(text, params);
    return result.rows[0];
  }
}

module.exports = new AuditLogRepository();
