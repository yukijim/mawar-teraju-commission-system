const jwt = require('jsonwebtoken');
const variables = require('../config/variables');
const userRepository = require('../repositories/userRepository');
const { sendResponse } = require('../utils/response');

/**
 * Authentication Middleware
 * Checks for JWT access tokens in cookies or Authorization headers,
 * decodes and verifies the token, and attaches the active user to the request.
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
        return sendResponse(res, 401, false, 'Access token is missing. Access denied.');
      }

      // Verify token
      const decoded = jwt.verify(token, variables.JWT_SECRET);

      // Verify user from database to ensure they are active
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        return sendResponse(res, 401, false, 'User associated with this token does not exist.');
      }

      if (user.status !== 'ACTIVE') {
        return sendResponse(res, 403, false, 'Your user account is currently deactivated.');
      }

      // Strip sensitive credentials from the request context user
      delete user.password_hash;

      req.user = user;
      next();
    } catch (err) {
      let errorMessage = 'Invalid token. Access denied.';
      if (err.name === 'TokenExpiredError') {
        errorMessage = 'Access token has expired. Please refresh your session.';
      }
      
      return sendResponse(res, 401, false, errorMessage);
    }
  };
};

/**
 * Authorization Middleware
 * Verifies if the authenticated user has one of the allowed roles.
 *
 * @param {...string} allowedRoles - List of permitted roles (e.g. 'ADMIN', 'DISPATCH')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendResponse(res, 401, false, 'User is not authenticated.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendResponse(res, 403, false, 'Forbidden. You do not have permission to access this resource.');
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
