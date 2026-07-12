const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Multer memory storage configuration (keeps file in memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
});

// Route Guards: Protect all endpoints for ADMIN role only
router.use(authenticate());
router.use(authorize('ADMIN'));

// POST /api/v1/upload/commission (with upload rate limiter)
router.post('/commission', uploadLimiter, upload.single('file'), uploadController.uploadCommission);

// POST /api/v1/upload/deduction (with upload rate limiter)
router.post('/deduction', uploadLimiter, upload.single('file'), uploadController.uploadDeduction);

// GET /api/v1/upload/history
router.get('/history', uploadController.getUploadHistory);

// GET /api/v1/upload/:batchId
router.get('/:batchId', uploadController.getBatchDetails);

module.exports = router;
