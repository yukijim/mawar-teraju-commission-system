const express = require('express');
const { adminLimiter } = require('../middleware/rateLimiter');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// GET /api/admin/summary (Legacy endpoint redirecting to health monitor metrics)
router.get('/summary', adminLimiter, dashboardController.getMonitorMetrics);

// POST /api/admin/backup (POST /api/v1/admin/backup)
router.post('/backup', adminLimiter, dashboardController.downloadBackup);

// POST /api/admin/clear-database
router.post('/clear-database', adminLimiter, dashboardController.clearDatabase);

// GET /api/admin/monitor (GET /api/v1/admin/monitor)
router.get('/monitor', adminLimiter, dashboardController.getMonitorMetrics);

module.exports = router;
