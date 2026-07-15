const express = require('express');
const reportController = require('../controllers/reportController');
const { reportDownloadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /api/v1/reports/commission/:recordId (accessible publicly without token)
router.get(
  '/commission/:recordId',
  reportDownloadLimiter,
  reportController.downloadCommissionReport
);

// GET /api/v1/reports/deduction/:recordId (accessible publicly without token)
router.get(
  '/deduction/:recordId',
  reportDownloadLimiter,
  reportController.downloadDeductionReport
);

module.exports = router;
