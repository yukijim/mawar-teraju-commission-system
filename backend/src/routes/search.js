const express = require('express');
const searchController = require('../controllers/searchController');
const { authenticate, authorize } = require('../middleware/auth');
const { searchLimiter, adminLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Authenticate all search engine hooks
router.use(authenticate());

// GET /api/v1/search (accessible to both ADMIN and DISPATCH roles)
router.get(
  '/',
  authorize('ADMIN', 'DISPATCH'),
  searchLimiter,
  searchController.searchCommissions
);

// GET /api/v1/search/history (accessible to ADMIN roles only)
router.get(
  '/history',
  authorize('ADMIN'),
  adminLimiter,
  searchController.getSearchHistory
);

// Export hooks endpoints (accessible to ADMIN and DISPATCH roles)
router.get(
  '/export/pdf',
  authorize('ADMIN', 'DISPATCH'),
  searchController.exportPdf
);

router.get(
  '/export/excel',
  authorize('ADMIN', 'DISPATCH'),
  searchController.exportExcel
);

module.exports = router;
