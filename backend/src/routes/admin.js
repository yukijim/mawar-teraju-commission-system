const express = require('express');
const { adminLimiter } = require('../middleware/rateLimiter');
const { sendResponse } = require('../utils/response');

const router = express.Router();

// Matches GET /api/admin/summary
router.get('/summary', adminLimiter, (req, res) => {
  return sendResponse(res, 200, true, 'Admin system metrics retrieved successfully.', {
    admin: {
      id: req.user.id,
      name: req.user.full_name,
      role: req.user.role,
    },
    systemMetrics: {
      activeBatches: 2,
      pendingDispatches: 15,
      lastBackupTime: new Date(),
    },
  });
});

module.exports = router;
