const rateLimit = require('express-rate-limit');
const { sendResponse } = require('../utils/response');

/**
 * Helper to build custom rate limiters that adhere to the standardized API error structure
 *
 * @param {number} windowMs - Rate limit window in milliseconds
 * @param {number} max - Maximum requests allowed per windowMs
 * @param {string} errCode - Standardized error code (e.g. 'AUTH_RATE_LIMIT_EXCEEDED')
 * @param {string} errMsg - User-friendly message
 */
const createLimiter = (windowMs, max, errCode, errMsg) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return sendResponse(
        res,
        429,
        false,
        errMsg,
        null,
        [],
        errCode
      );
    },
  });
};

// 1. Login Limiter: 5 requests per minute
const loginLimiter = createLimiter(
  60 * 1000, // 1 minute
  5,
  'AUTH_RATE_LIMIT_EXCEEDED',
  'Too many login attempts. Please try again in 1 minute.'
);

// 2. Search Limiter: 100 requests per minute
const searchLimiter = createLimiter(
  60 * 1000, // 1 minute
  100,
  'SEARCH_RATE_LIMIT_EXCEEDED',
  'Too many search requests. Please throttle your queries.'
);

// 3. Upload Limiter: 20 requests per minute
const uploadLimiter = createLimiter(
  60 * 1000, // 1 minute
  20,
  'UPLOAD_RATE_LIMIT_EXCEEDED',
  'Too many file upload requests. Please slow down.'
);

// 4. Admin Limiter: 60 requests per minute
const adminLimiter = createLimiter(
  60 * 1000, // 1 minute
  60,
  'ADMIN_RATE_LIMIT_EXCEEDED',
  'Too many administrative requests. Access throttled.'
);

// 5. Public Search Limiter: 30 requests per minute
const publicSearchLimiter = createLimiter(
  60 * 1000, // 1 minute
  30,
  'SEARCH_RATE_LIMIT_EXCEEDED',
  'Too many search attempts. Please slow down.'
);

// 6. Report Download Limiter: 10 requests per minute
const reportDownloadLimiter = createLimiter(
  60 * 1000, // 1 minute
  10,
  'REPORT_RATE_LIMIT_EXCEEDED',
  'Too many report download attempts. Access throttled.'
);

module.exports = {
  loginLimiter,
  searchLimiter,
  uploadLimiter,
  adminLimiter,
  publicSearchLimiter,
  reportDownloadLimiter,
};
