const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Service Layer for managing and formatting security audit trail logging.
 */
class AuditLogService {
  /**
   * Helper to parse client headers for IP and User Agent
   * @param {object} req - Express Request object
   * @returns {{ipAddress: string, userAgent: string}}
   */
  extractClientMeta(req) {
    if (!req) {
      return { ipAddress: 'unknown', userAgent: 'unknown' };
    }
    const ipAddress = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    const userAgent = req.headers?.['user-agent'] || 'unknown';
    return { ipAddress, userAgent };
  }

  /**
   * Logs a successful login event
   */
  async logSuccessLogin(userId, req, details = {}) {
    const { ipAddress, userAgent } = this.extractClientMeta(req);
    return auditLogRepository.createLog({
      userId,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
      details,
    });
  }

  /**
   * Logs a failed login event
   */
  async logFailedLogin(username, req, details = {}) {
    const { ipAddress, userAgent } = this.extractClientMeta(req);
    return auditLogRepository.createLog({
      userId: null,
      action: 'LOGIN_FAILED',
      ipAddress,
      userAgent,
      status: 'FAILED',
      details: { ...details, attemptedUsername: username },
    });
  }

  /**
   * Logs a logout event
   */
  async logLogout(userId, req, details = {}) {
    const { ipAddress, userAgent } = this.extractClientMeta(req);
    return auditLogRepository.createLog({
      userId,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
      details,
    });
  }

  /**
   * Logs an invalid JWT token access attempt
   */
  async logInvalidJwt(req, details = {}) {
    const { ipAddress, userAgent } = this.extractClientMeta(req);
    return auditLogRepository.createLog({
      userId: null,
      action: 'INVALID_JWT',
      ipAddress,
      userAgent,
      status: 'FAILED',
      details,
    });
  }

  /**
   * Logs successful refresh token rotation
   */
  async logRefreshTokenUsage(userId, req, details = {}) {
    const { ipAddress, userAgent } = this.extractClientMeta(req);
    return auditLogRepository.createLog({
      userId,
      action: 'REFRESH_TOKEN_USAGE',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
      details,
    });
  }
}

module.exports = new AuditLogService();
