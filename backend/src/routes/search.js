const express = require('express');
const searchController = require('../controllers/searchController');
const { authenticate, authorize } = require('../middleware/auth');
const { searchLimiter, adminLimiter, publicSearchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /api/v1/search (accessible publicly without token)
router.get(
  '/',
  publicSearchLimiter,
  searchController.searchCommissions
);

// GET /api/v1/search/history (accessible to ADMIN roles only)
router.get(
  '/history',
  authenticate(),
  authorize('ADMIN'),
  adminLimiter,
  searchController.getSearchHistory
);

// Export hooks endpoints (accessible to ADMIN roles only)
router.get(
  '/export/pdf',
  authenticate(),
  authorize('ADMIN'),
  searchController.exportPdf
);

router.get(
  '/export/excel',
  authenticate(),
  authorize('ADMIN'),
  searchController.exportExcel
);

module.exports = router;
