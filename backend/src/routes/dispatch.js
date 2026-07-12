const express = require('express');
const { searchLimiter } = require('../middleware/rateLimiter');
const { sendResponse } = require('../utils/response');

const router = express.Router();

// Matches GET /api/dispatch/commissions
router.get('/commissions', searchLimiter, (req, res) => {
  return sendResponse(res, 200, true, 'Dispatcher commission details retrieved successfully.', {
    dispatcher: {
      id: req.user.id,
      name: req.user.full_name,
      role: req.user.role,
    },
    commissions: [
      { id: 101, period: 'July 2026', amount: 1560.50, status: 'PROCESSED' },
      { id: 102, period: 'June 2026', amount: 1420.00, status: 'PAID' },
    ],
  });
});

module.exports = router;
