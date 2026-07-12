const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Guard route hooks: Authenticate all report requests
router.use(authenticate());

// GET /api/v1/reports/commission/:recordId (accessible to ADMIN and DISPATCH roles)
router.get(
  '/commission/:recordId',
  authorize('ADMIN', 'DISPATCH'),
  searchLimiter,
  reportController.downloadCommissionReport
);

// GET /api/v1/reports/deduction/:recordId (accessible to ADMIN and DISPATCH roles)
router.get(
  '/deduction/:recordId',
  authorize('ADMIN', 'DISPATCH'),
  searchLimiter,
  reportController.downloadDeductionReport
);

module.exports = router;
