const jwt = require('jsonwebtoken');
const variables = require('../config/variables');
const userRepository = require('../repositories/userRepository');
const auditLogService = require('../services/auditLogService');
const { sendResponse } = require('../utils/response');

/**
 * Authentication Middleware
 * Checks for JWT access tokens, decodes and verifies, and alerts the audit logs on failure.
 */
const authenticate = () => {
  return async (req, res, next) => {
    try {
      let token = null;

      // 1. Check HTTP-only cookies first
      if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
      }
      
      // 2. Fallback to Authorization Header Bearer token
      if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        // Log invalid JWT request: missing token
        await auditLogService.logInvalidJwt(req, { reason: 'Missing access token' });
        return sendResponse(res, 401, false, 'Access token is missing. Access denied.', null, [], 'AUTH_MISSING_TOKEN');
      }

      // Verify token signature with JWT_SECRET
      let decoded;
      try {
        decoded = jwt.verify(token, variables.JWT_SECRET);
      } catch (jwtErr) {
        // Log invalid JWT request: failed verification or expired
        await auditLogService.logInvalidJwt(req, { reason: 'Token verification failed', message: jwtErr.message });
        
        let errCode = 'AUTH_INVALID_TOKEN';
        let errMsg = 'Invalid token. Access denied.';
        
        if (jwtErr.name === 'TokenExpiredError') {
          errCode = 'AUTH_EXPIRED_TOKEN';
          errMsg = 'Access token has expired. Please refresh your session.';
        }
        
        return sendResponse(res, 401, false, errMsg, null, [], errCode);
      }

      // Verify user from database to ensure they still exist and are active
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        await auditLogService.logInvalidJwt(req, { reason: 'Token user not found', userId: decoded.userId });
        return sendResponse(res, 401, false, 'User associated with this token does not exist.', null, [], 'AUTH_USER_NOT_FOUND');
      }

      if (user.status !== 'ACTIVE') {
        await auditLogService.logInvalidJwt(req, { reason: 'Token user deactivated', userId: decoded.userId });
        return sendResponse(res, 403, false, 'Your user account is currently deactivated.', null, [], 'AUTH_USER_DEACTIVATED');
      }

      // Strip sensitive credentials from the request context user
      delete user.password_hash;

      req.user = user;
      next();
    } catch (err) {
      console.error('[Auth Middleware Internal Error]', err.message);
      return sendResponse(res, 500, false, 'Internal server authentication error.', null, [], 'SERVER_ERROR');
    }
  };
};

/**
 * Authorization Middleware
 * Verifies if the authenticated user has one of the allowed roles.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendResponse(res, 401, false, 'User is not authenticated.', null, [], 'AUTH_NOT_AUTHENTICATED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendResponse(res, 403, false, 'Forbidden. You do not have permission to access this resource.', null, [], 'AUTH_FORBIDDEN');
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
