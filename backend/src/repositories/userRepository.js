const db = require('../config/database');

/**
 * Data Access Layer for User and Session authentication structures.
 * Now hardened with UUIDs and token hash support.
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
   * Saves a newly generated refresh token hash
   * @param {string} userId - UUID string
   * @param {string} tokenHash - SHA-256 hash of refresh token
   * @param {Date} expiresAt - Date timestamp when token expires
   * @returns {Promise<object>}
   */
  async saveRefreshToken(userId, tokenHash, expiresAt) {
    const text = `
      INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(text, [userId, tokenHash, expiresAt]);
    return result.rows[0];
  }

  /**
   * Finds a refresh token record by hash
   * @param {string} userId - UUID string
   * @param {string} tokenHash - SHA-256 hash of refresh token
   * @returns {Promise<object|null>}
   */
  async findRefreshToken(userId, tokenHash) {
    const text = `
      SELECT * FROM user_refresh_tokens 
      WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
    `;
    const result = await db.query(text, [userId, tokenHash]);
    return result.rows[0] || null;
  }

  /**
   * Revokes a refresh token in the database (sets revoked_at timestamp)
   * @param {string} userId - UUID string
   * @param {string} tokenHash - SHA-256 hash of refresh token
   * @returns {Promise<boolean>}
   */
  async revokeRefreshToken(userId, tokenHash) {
    const text = `
      UPDATE user_refresh_tokens 
      SET revoked_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
    `;
    const result = await db.query(text, [userId, tokenHash]);
    return result.rowCount > 0;
  }

  /**
   * Revokes all refresh tokens for a user (forces full logout across all devices)
   * @param {string} userId - UUID string
   * @returns {Promise<void>}
   */
  async revokeAllRefreshTokens(userId) {
    const text = `
      UPDATE user_refresh_tokens 
      SET revoked_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    await db.query(text, [userId]);
  }
}

module.exports = new UserRepository();
