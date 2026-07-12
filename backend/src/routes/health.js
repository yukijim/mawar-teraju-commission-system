const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

// Mounts at /api/health
router.get('/health', healthController.getHealth);

module.exports = router;
