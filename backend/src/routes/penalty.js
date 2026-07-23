const express = require('express');
const multer = require('multer');
const penaltyController = require('../controllers/penaltyController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadLimiter, publicSearchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Multer memory storage configuration (keeps file in memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
});

// POST /api/v1/penalty/upload (restricted to ADMIN, with upload rate limiter)
router.post(
  '/upload',
  authenticate(),
  authorize('ADMIN'),
  uploadLimiter,
  upload.single('file'),
  penaltyController.uploadPenalty
);

// GET /api/v1/penalty/upload-history (restricted to ADMIN)
router.get(
  '/upload-history',
  authenticate(),
  authorize('ADMIN'),
  penaltyController.getUploadHistory
);

// GET /api/v1/penalty/stats (restricted to ADMIN)
router.get(
  '/stats',
  authenticate(),
  authorize('ADMIN'),
  penaltyController.getStats
);

// GET /api/v1/penalty/search (public search for dispatcher detailed penalties)
router.get(
  '/search',
  publicSearchLimiter,
  penaltyController.searchPenalties
);

module.exports = router;
