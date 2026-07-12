const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const auditLogService = require('./auditLogService');
const variables = require('../config/variables');

/**
 * Service Layer containing business logic for authentication and token validation.
 * Integrated with SHA-256 token hashing, separate JWT secrets, and security audit log tracing.
 */
class AuthService {
  /**
   * Generates SHA-256 hash of a string token
   * @param {string} token
   * @returns {string} - Hex digest
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a short-lived access JWT token (valid for 15 minutes) using JWT_SECRET
   * @param {object} user - User record from the database
   * @returns {string} - Signed JWT token
   */
  generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      variables.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  /**
   * Generates a long-lived refresh JWT token (valid for 7 days) using JWT_REFRESH_SECRET
   * @param {object} user - User record from the database
   * @returns {string} - Signed JWT token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id },
      variables.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Authenticates user credentials, registers successful/failed logs, and issues secure tokens
   * @param {string} username
   * @param {string} password
   * @param {object} req - Express Request object for client headers audit logging
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
   */
  async login(username, password, req) {
    // 1. Fetch user by username
    const user = await userRepository.findByUsername(username);
    if (!user) {
      await auditLogService.logFailedLogin(username, req, { reason: 'User not found' });
      throw new Error('Invalid username or password.');
    }

    // 2. Verify account status
    if (user.status !== 'ACTIVE') {
      await auditLogService.logFailedLogin(username, req, { reason: 'Account suspended/inactive' });
      throw new Error('This account has been deactivated. Please contact support.');
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await auditLogService.logFailedLogin(username, req, { reason: 'Password mismatch' });
      throw new Error('Invalid username or password.');
    }

    // 4. Generate new tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 5. Hash refresh token using SHA-256 before saving to PostgreSQL database
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await userRepository.saveRefreshToken(user.id, tokenHash, expiresAt);

    // 6. Register audit trail record
    await auditLogService.logSuccessLogin(user.id, req);

    // Strip password_hash before returning
    delete user.password_hash;

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Generates a new access token from a valid refresh token and logs token usage
   * @param {string} token - Refresh token
   * @param {object} req - Express Request object
   * @returns {Promise<{accessToken: string}>}
   */
  async refresh(token, req) {
    try {
      // Verify token signature & authenticity with JWT_REFRESH_SECRET
      const decoded = jwt.verify(token, variables.JWT_REFRESH_SECRET);
      
      // Hash the refresh token to query database
      const tokenHash = this.hashToken(token);

      // Look up token hash in database
      const storedToken = await userRepository.findRefreshToken(decoded.userId, tokenHash);
      if (!storedToken) {
        throw new Error('Session is invalid or has been revoked.');
      }

      // Check expiration manually
      if (new Date() > new Date(storedToken.expires_at)) {
        await userRepository.revokeRefreshToken(decoded.userId, tokenHash);
        throw new Error('Session has expired. Please login again.');
      }

      // Get user status
      const user = await userRepository.findById(decoded.userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User account is suspended or no longer exists.');
      }

      // Issue a new access token
      const accessToken = this.generateAccessToken(user);

      // Log successful refresh usage
      await auditLogService.logRefreshTokenUsage(user.id, req);

      return {
        accessToken,
      };
    } catch (err) {
      throw new Error(err.message || 'Token refresh failed.');
    }
  }

  /**
   * Revokes a refresh token and registers logout trace in audit_logs
   * @param {string} userId - UUID string
   * @param {string} token - Refresh token string
   * @param {object} req - Express Request object
   * @returns {Promise<void>}
   */
  async logout(userId, token, req) {
    if (token) {
      const tokenHash = this.hashToken(token);
      await userRepository.revokeRefreshToken(userId, tokenHash);
    }
    await auditLogService.logLogout(userId, req);
  }
}

module.exports = new AuthService();
