const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');
const variables = require('../config/variables');

/**
 * Service Layer containing business logic for authentication and token validation.
 */
class AuthService {
  /**
   * Generates a short-lived access JWT token (valid for 15 minutes)
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
   * Generates a long-lived refresh JWT token (valid for 7 days)
   * @param {object} user - User record from the database
   * @returns {string} - Signed JWT token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id },
      variables.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Authenticates user credentials, sets up session, and issues tokens
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
   */
  async login(username, password) {
    // 1. Fetch user by username
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password.');
    }

    // 2. Verify account status
    if (user.status !== 'ACTIVE') {
      throw new Error('This account has been deactivated. Please contact support.');
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid username or password.');
    }

    // 4. Generate new tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 5. Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

    // Strip password_hash before returning
    delete user.password_hash;

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Generates a new access token from a valid refresh token
   * @param {string} token - Refresh token
   * @returns {Promise<{accessToken: string}>}
   */
  async refresh(token) {
    try {
      // Verify token signature & authenticity
      const decoded = jwt.verify(token, variables.JWT_SECRET);
      
      // Look up token in database to make sure it was not revoked
      const storedToken = await userRepository.findRefreshToken(decoded.userId, token);
      if (!storedToken) {
        throw new Error('Session is invalid or has been revoked.');
      }

      // Check expiration manually (in case check-in database times vary)
      if (new Date() > new Date(storedToken.expires_at)) {
        await userRepository.revokeRefreshToken(decoded.userId, token);
        throw new Error('Session has expired. Please login again.');
      }

      // Get user status
      const user = await userRepository.findById(decoded.userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User account is suspended or no longer exists.');
      }

      // Issue a new access token
      const accessToken = this.generateAccessToken(user);

      return {
        accessToken,
      };
    } catch (err) {
      throw new Error(err.message || 'Token refresh failed.');
    }
  }

  /**
   * Revokes a refresh token during user logout
   * @param {string} userId - UUID string
   * @param {string} token - Refresh token string
   * @returns {Promise<void>}
   */
  async logout(userId, token) {
    if (token) {
      await userRepository.revokeRefreshToken(userId, token);
    }
  }
}

module.exports = new AuthService();
