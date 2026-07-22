const db = require('../config/database');

const inMemoryPenalties = [];

/**
 * Repository layer for Penalty Records database operations.
 * Supports PostgreSQL with seamless in-memory fallback for local dev/testing environments.
 * Handles resolving IC/Passport -> Dispatcher ID using dispatcher_mappings.
 */
class PenaltyRepository {
  /**
   * Bulk inserts penalty records with conflict handling (upsert on AWB duplicate)
   * @param {object} client - pg pool client
   * @param {Array<object>} records - array of penalty record objects
   */
  async bulkInsertPenaltyRecords(client, records) {
    if (!records || records.length === 0) return;

    // Synchronize to in-memory fallback store
    records.forEach(rec => {
      const idx = inMemoryPenalties.findIndex(p => p.awb === rec.awb);
      if (idx >= 0) {
        inMemoryPenalties[idx] = { ...inMemoryPenalties[idx], ...rec, updated_at: new Date() };
      } else {
        inMemoryPenalties.push({ ...rec, created_at: new Date(), updated_at: new Date() });
      }
    });

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    records.forEach(r => {
      valuePlaceholders.push(`(
        $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2},
        $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5},
        $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8},
        $${paramIndex + 9}
      )`);

      values.push(
        r.delivery_dispatcher_id,
        r.delivery_dispatcher_name,
        r.awb,
        r.fake_return || 0,
        r.fake_problematic || 0,
        r.fraud_delivery || 0,
        r.arbitration || 0,
        r.individual_lost || 0,
        r.logic || '',
        r.uploaded_by
      );

      paramIndex += 10;
    });

    const text = `
      INSERT INTO penalty_records (
        delivery_dispatcher_id, delivery_dispatcher_name, awb,
        fake_return, fake_problematic, fraud_delivery, arbitration, individual_lost, logic,
        uploaded_by
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (awb) DO UPDATE SET
        delivery_dispatcher_id = EXCLUDED.delivery_dispatcher_id,
        delivery_dispatcher_name = EXCLUDED.delivery_dispatcher_name,
        fake_return = EXCLUDED.fake_return,
        fake_problematic = EXCLUDED.fake_problematic,
        fraud_delivery = EXCLUDED.fraud_delivery,
        arbitration = EXCLUDED.arbitration,
        individual_lost = EXCLUDED.individual_lost,
        logic = EXCLUDED.logic,
        uploaded_by = EXCLUDED.uploaded_by,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    if (client && client.query) {
      try {
        await client.query(text, values);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
          console.warn('[PenaltyRepository] DB unavailable, saved to in-memory fallback store.');
          return;
        }
        throw err;
      }
    }
  }

  /**
   * Searches all penalty records matching a Dispatcher ID or IC/Passport Number
   * @param {string} identifier - Dispatcher ID or IC/Passport Number
   * @returns {Promise<Array<object>>}
   */
  async searchPenaltyRecords(identifier) {
    const cleanId = identifier.toString().toUpperCase().trim();
    const cleanIc = cleanId.replace(/[\s-]/g, '');

    const text = `
      SELECT * FROM penalty_records 
      WHERE UPPER(delivery_dispatcher_id) = $1
         OR UPPER(delivery_dispatcher_id) IN (
              SELECT UPPER(dispatcher_id) FROM dispatcher_mappings 
              WHERE UPPER(ic_number) = $1 OR UPPER(ic_number) = $2
            )
      ORDER BY awb ASC
    `;
    try {
      const result = await db.query(text, [cleanId, cleanIc]);
      return result.rows;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        console.warn('[PenaltyRepository] DB unavailable, reading from in-memory fallback store.');
        return inMemoryPenalties.filter(r => 
          (r.delivery_dispatcher_id || '').toUpperCase().trim() === cleanId ||
          (r.delivery_dispatcher_id || '').toUpperCase().trim() === cleanIc
        );
      }
      throw err;
    }
  }

  /**
   * Retrieves summary sums of penalty columns for a Dispatcher ID or IC/Passport Number
   * @param {string} identifier - Dispatcher ID or IC/Passport Number
   * @returns {Promise<object>}
   */
  async getPenaltySummary(identifier) {
    if (!identifier) {
      return { fake_return: 0, fake_problematic: 0, fraud_delivery: 0, arbitration: 0, individual_lost: 0 };
    }

    const cleanId = identifier.toString().toUpperCase().trim();
    const cleanIc = cleanId.replace(/[\s-]/g, '');

    const text = `
      SELECT 
        COALESCE(SUM(fake_return), 0.0000) as fake_return,
        COALESCE(SUM(fake_problematic), 0.0000) as fake_problematic,
        COALESCE(SUM(fraud_delivery), 0.0000) as fraud_delivery,
        COALESCE(SUM(arbitration), 0.0000) as arbitration,
        COALESCE(SUM(individual_lost), 0.0000) as individual_lost
      FROM penalty_records
      WHERE UPPER(delivery_dispatcher_id) = $1
         OR UPPER(delivery_dispatcher_id) IN (
              SELECT UPPER(dispatcher_id) FROM dispatcher_mappings 
              WHERE UPPER(ic_number) = $1 OR UPPER(ic_number) = $2
            )
    `;
    try {
      const result = await db.query(text, [cleanId, cleanIc]);
      return result.rows[0] || { fake_return: 0, fake_problematic: 0, fraud_delivery: 0, arbitration: 0, individual_lost: 0 };
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED') || err.code === '42P01') {
        console.warn('[PenaltyRepository] DB unavailable or penalty_records table missing, returning default summary.');
        const matching = inMemoryPenalties.filter(r => 
          (r.delivery_dispatcher_id || '').toUpperCase().trim() === cleanId ||
          (r.delivery_dispatcher_id || '').toUpperCase().trim() === cleanIc
        );
        const summary = {
          fake_return: 0, fake_problematic: 0, fraud_delivery: 0,
          arbitration: 0, individual_lost: 0
        };
        matching.forEach(r => {
          summary.fake_return += Number(r.fake_return || 0);
          summary.fake_problematic += Number(r.fake_problematic || 0);
          summary.fraud_delivery += Number(r.fraud_delivery || 0);
          summary.arbitration += Number(r.arbitration || 0);
          summary.individual_lost += Number(r.individual_lost || 0);
        });
        return summary;
      }
      console.error('[PenaltyRepository] Error fetching penalty summary:', err.message);
      return { fake_return: 0, fake_problematic: 0, fraud_delivery: 0, arbitration: 0, individual_lost: 0 };
    }
  }
}

module.exports = new PenaltyRepository();
