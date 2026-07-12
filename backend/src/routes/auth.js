const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { sendResponse } = require('../utils/response');

const router = express.Router();

/**
 * Validation checker helper middleware
 */
const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResponse(res, 400, false, 'Validation check failed.', null, errors.array());
  }
  next();
};

// POST /api/auth/login
router.post(
  '/login',
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username field is required.')
      .isLength({ min: 3, max: 100 })
      .withMessage('Username must be between 3 and 100 characters.'),
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
router.post('/refresh', authController.refresh);

// GET /api/auth/me
router.get('/me', authenticate(), authController.me);

module.exports = router;
