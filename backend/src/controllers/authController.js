const authService = require('../services/authService');
const { sendResponse } = require('../utils/response');

/**
 * Controller handling user authentication requests.
 */
class AuthController {
  /**
   * POST /api/auth/login
   * Validates credentials and writes JWT access & refresh tokens to HTTP-only cookies.
   */
  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;
      
      const { user, accessToken, refreshToken } = await authService.login(username, password, req);

      const isProduction = process.env.NODE_ENV === 'production';

      // 1. Write HTTP-only cookie for the short-lived access token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // 2. Write HTTP-only cookie for the long-lived refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return sendResponse(res, 200, true, 'User logged in successfully.', {
        user,
        accessToken,
        refreshToken,
      });
    } catch (err) {
      return sendResponse(res, 401, false, err.message || 'Login failed.', null, [], 'AUTH_INVALID_CREDENTIALS');
    }
  };

  /**
   * POST /api/auth/logout
   * Revokes refresh token in database and clears HTTP-only cookies.
   */
  logout = async (req, res, next) => {
    try {
      const userId = req.user ? req.user.id : null;
      let refreshToken = null;

      if (req.cookies && req.cookies.refreshToken) {
        refreshToken = req.cookies.refreshToken;
      }

      if (userId) {
        await authService.logout(userId, refreshToken, req);
      }

      // Clear both cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      return sendResponse(res, 200, true, 'Logged out successfully.');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/auth/me
   * Retrieves profile data of the currently logged-in user.
   */
  me = async (req, res, next) => {
    try {
      return sendResponse(res, 200, true, 'User profile retrieved successfully.', {
        user: req.user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/auth/refresh
   * Decodes and validates refresh token, then issues a new access token.
   */
  refresh = async (req, res, next) => {
    try {
      let refreshToken = null;
      
      if (req.cookies && req.cookies.refreshToken) {
        refreshToken = req.cookies.refreshToken;
      }

      if (!refreshToken && req.body.refreshToken) {
        refreshToken = req.body.refreshToken;
      }

      if (!refreshToken) {
        return sendResponse(res, 400, false, 'Refresh token is missing.', null, [], 'AUTH_MISSING_REFRESH_TOKEN');
      }

      const { accessToken } = await authService.refresh(refreshToken, req);
      const isProduction = process.env.NODE_ENV === 'production';

      // Update the access token cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      return sendResponse(res, 200, true, 'Token refreshed successfully.', {
        accessToken,
      });
    } catch (err) {
      return sendResponse(res, 401, false, err.message || 'Token refresh failed.', null, [], 'AUTH_INVALID_REFRESH_TOKEN');
    }
  };
}

module.exports = new AuthController();
