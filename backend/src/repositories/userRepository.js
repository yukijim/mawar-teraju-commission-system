const db = require('../config/database');

/**
 * Data Access Layer for User and Session authentication structures.
 */
class UserRepository {
  /**
   * Retrieves a user by their username
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async findByUsername(username) {
    const text = 'SELECT * FROM users WHERE username = $1';
    const result = await db.query(text, [username]);
    return result.rows[0] || null;
  }

  /**
   * Retrieves a user by their UUID primary key
   * @param {string} id - UUID string
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const text = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(text, [id]);
    return result.rows[0] || null;
  }

  /**
   * Saves a newly generated refresh token
   * @param {string} userId - UUID string
   * @param {string} token - Signed JWT refresh token
   * @param {Date} expiresAt - Date timestamp when token expires
   * @returns {Promise<object>}
   */
  async saveRefreshToken(userId, token, expiresAt) {
    const text = `
      INSERT INTO user_refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(text, [userId, token, expiresAt]);
    return result.rows[0];
  }

  /**
   * Finds a refresh token record
   * @param {string} userId - UUID string
   * @param {string} token - Signed JWT refresh token
   * @returns {Promise<object|null>}
   */
  async findRefreshToken(userId, token) {
    const text = 'SELECT * FROM user_refresh_tokens WHERE user_id = $1 AND token = $2';
    const result = await db.query(text, [userId, token]);
    return result.rows[0] || null;
  }

  /**
   * Deletes a refresh token from the database (revocation / logout)
   * @param {string} userId - UUID string
   * @param {string} token - Signed JWT refresh token
   * @returns {Promise<boolean>}
   */
  async revokeRefreshToken(userId, token) {
    const text = 'DELETE FROM user_refresh_tokens WHERE user_id = $1 AND token = $2';
    const result = await db.query(text, [userId, token]);
    return result.rowCount > 0;
  }

  /**
   * Deletes all refresh tokens for a user (forces full logout across all devices)
   * @param {string} userId - UUID string
   * @returns {Promise<void>}
   */
  async revokeAllRefreshTokens(userId) {
    const text = 'DELETE FROM user_refresh_tokens WHERE user_id = $1';
    await db.query(text, [userId]);
  }
}

module.exports = new UserRepository();
