const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { sendResponse } = require('../utils/response');

const router = express.Router();

/**
 * Validation checker helper middleware
 * Structures validation errors under standard API format
 */
const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResponse(res, 400, false, 'Validation check failed.', null, errors.array(), 'AUTH_VALIDATION_ERROR');
  }
  next();
};

// POST /api/auth/login (with loginLimiter and input sanitization)
router.post(
  '/login',
  loginLimiter,
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username field is required.')
      .isLength({ min: 3, max: 100 })
      .withMessage('Username must be between 3 and 100 characters.')
      .escape(), // Sanitizes input against XSS
    body('password')
      .notEmpty()
      .withMessage('Password field is required.'),
  ],
  validateFields,
  authController.login
);

// POST /api/auth/logout
router.post('/logout', authenticate(), authController.logout);

// POST /api/auth/refresh
router.post('/refresh', loginLimiter, authController.refresh);

// GET /api/auth/me
router.get('/me', authenticate(), authController.me);

// PUT /api/auth/password - Enforces strong password complexity policy
router.put(
  '/password',
  authenticate(),
  [
    body('oldPassword')
      .notEmpty()
      .withMessage('Old password is required.'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters long.')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/[^a-zA-Z0-9]/)
      .withMessage('Password must contain at least one special character.'),
  ],
  validateFields,
  async (req, res, next) => {
    // Custom inline demonstration handler for changing password
    try {
      return sendResponse(res, 200, true, 'Password changed successfully.');
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
