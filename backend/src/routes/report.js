const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /api/v1/reports/commission/:recordId (accessible publicly without token)
router.get(
  '/commission/:recordId',
  searchLimiter,
  reportController.downloadCommissionReport
);

// GET /api/v1/reports/deduction/:recordId (accessible publicly without token)
router.get(
  '/deduction/:recordId',
  searchLimiter,
  reportController.downloadDeductionReport
);

module.exports = router;
