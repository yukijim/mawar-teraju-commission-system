const express = require('express');
const { searchLimiter } = require('../middleware/rateLimiter');
const { sendResponse } = require('../utils/response');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/dispatch/commissions
 * Retrieves commission records for the logged-in dispatcher.
 * Enforces that dispatcher queries MUST only use PUBLISHED batches.
 */
router.get('/commissions', searchLimiter, async (req, res, next) => {
  try {
    const username = req.user.username; // Dispatcher's identifier

    // 1. Resolve NRIC (IC number)
    let icNumber = null;
    if (/^\d{12}$/.test(username)) {
      icNumber = username;
    } else {
      // Look up mapping in dispatcher_mappings
      const mappingRes = await db.query(
        'SELECT ic_number FROM dispatcher_mappings WHERE dispatcher_id = $1',
        [username]
      );
      if (mappingRes.rows.length > 0) {
        icNumber = mappingRes.rows[0].ic_number;
      }
    }

    if (!icNumber) {
      return sendResponse(res, 200, true, 'No dispatcher profile mapping found in database.', {
        dispatcher: {
          id: req.user.id,
          name: req.user.full_name,
          username: req.user.username,
          role: req.user.role,
        },
        commissions: [],
      });
    }

    // 2. Query only PUBLISHED batches (dispatcher queries MUST only use PUBLISHED batches)
    const queryText = `
      SELECT c.*, b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active
      FROM commission_records c
      JOIN batches b ON c.batch_id = b.id
      WHERE c.ic_number = $1 AND b.status = 'PUBLISHED'
      ORDER BY b.year DESC, b.month DESC
    `;
    const result = await db.query(queryText, [icNumber]);

    return sendResponse(res, 200, true, 'Dispatcher commission details retrieved successfully.', {
      dispatcher: {
        id: req.user.id,
        name: req.user.full_name,
        username: req.user.username,
        role: req.user.role,
        icNumber,
      },
      commissions: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
