const express = require('express');
const { adminLimiter } = require('../middleware/rateLimiter');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Guard route: Only authenticated ADMIN users can access dashboard statistics
router.use(authenticate());
router.use(authorize('ADMIN'));

// GET /api/v1/dashboard/summary
router.get('/summary', adminLimiter, dashboardController.getSummary);

module.exports = router;
