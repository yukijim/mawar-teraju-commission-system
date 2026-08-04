const db = require('../config/database');
const { AppError } = require('../middleware/error');

const inMemoryPenalties = [];
const inMemoryBatches = [];

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

    // Deduplicate records within batch payload by AWB key to avoid PostgreSQL 21000 ON CONFLICT error
    const deduplicatedMap = new Map();
    records.forEach(rec => {
      const existing = deduplicatedMap.get(rec.awb);
      if (existing) {
        // Merge numeric values and concatenate logic descriptions
        deduplicatedMap.set(rec.awb, {
          ...existing,
          ...rec,
          fake_return: parseFloat(existing.fake_return || 0) + parseFloat(rec.fake_return || 0),
          fake_problematic: parseFloat(existing.fake_problematic || 0) + parseFloat(rec.fake_problematic || 0),
          fraud_delivery: parseFloat(existing.fraud_delivery || 0) + parseFloat(rec.fraud_delivery || 0),
          arbitration: parseFloat(existing.arbitration || 0) + parseFloat(rec.arbitration || 0),
          individual_lost: parseFloat(existing.individual_lost || 0) + parseFloat(rec.individual_lost || 0),
          logic: [existing.logic, rec.logic].filter(Boolean).join('; ')
        });
      } else {
        deduplicatedMap.set(rec.awb, { ...rec });
      }
    });

    const uniqueRecords = Array.from(deduplicatedMap.values());

    // Synchronize to in-memory fallback store
    uniqueRecords.forEach(rec => {
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

    uniqueRecords.forEach(r => {
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
        if (err.code === '21000') {
          throw new AppError('Ralat pangkalan data: Terdapat rekod AWB bertindih dalam kelompok muat naik yang sama.', 400, 'DB_DUPLICATE_IN_BATCH');
        } else if (err.code === '23503') {
          throw new AppError('Ralat pangkalan data: Pengguna muat naik tidak wujud (Foreign key violation).', 400, 'DB_FOREIGN_KEY_VIOLATION');
        } else if (err.code === '22P02') {
          throw new AppError('Ralat jenis data pangkalan data: Format nilai tidak sepadan dengan skema pangkalan data.', 400, 'DB_INVALID_DATA_TYPE');
        } else if (err.code === '42P01') {
          throw new AppError('Jadual pangkalan data penalty_records belum dicipta.', 400, 'DB_TABLE_MISSING');
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

  /**
   * Logs a new penalty file upload entry
   */
  /**
   * Logs a new penalty file upload entry
   */
  async createPenaltyUploadBatch({ filename, recordsImported, uploadedBy }) {
    const newBatch = {
      id: inMemoryBatches.length + 1,
      filename,
      records_imported: recordsImported,
      uploaded_by: uploadedBy || null,
      uploaded_at: new Date()
    };
    inMemoryBatches.unshift(newBatch);

    const text = `
      INSERT INTO penalty_upload_batches (filename, records_imported, uploaded_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    try {
      const result = await db.query(text, [filename, recordsImported, uploadedBy || null]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        console.warn('[PenaltyRepository] DB unavailable or penalty_upload_batches table missing, using in-memory store.');
        return newBatch;
      }
      throw err;
    }
  }

  /**
   * Retrieves past penalty upload logs
   */
  async getPenaltyUploadHistory(limit = 20) {
    const text = `
      SELECT b.id, b.filename, b.records_imported, b.uploaded_at, u.username as uploaded_by_user
      FROM penalty_upload_batches b
      LEFT JOIN users u ON b.uploaded_by = u.id
      ORDER BY b.uploaded_at DESC
      LIMIT $1
    `;
    try {
      const result = await db.query(text, [limit]);
      return result.rows;
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        return inMemoryBatches.slice(0, limit);
      }
      throw err;
    }
  }

  /**
   * Returns total count of penalty_records rows
   */
  async getTotalPenaltyRecordsCount() {
    const text = `SELECT COUNT(*) as count FROM penalty_records`;
    try {
      const result = await db.query(text);
      return parseInt(result.rows[0].count, 10);
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        return inMemoryPenalties.length;
      }
      return inMemoryPenalties.length;
    }
  }

  /**
   * Deletes a penalty upload log entry
   */
  async deletePenaltyUploadBatch(id) {
    const text = `DELETE FROM penalty_upload_batches WHERE id = $1 RETURNING *`;
    try {
      const result = await db.query(text, [id]);
      return result.rows[0] || null;
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        const idx = inMemoryBatches.findIndex(b => b.id === Number(id));
        if (idx >= 0) return inMemoryBatches.splice(idx, 1)[0];
        return null;
      }
      throw err;
    }
  }

  /**
   * Clears all penalty records (used when penalty upload log is deleted)
   */
  async clearAllPenaltyRecords() {
    const text = `DELETE FROM penalty_records`;
    try {
      await db.query(text);
      inMemoryPenalties.length = 0;
      return true;
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        inMemoryPenalties.length = 0;
        return true;
      }
      throw err;
    }
  }

  /**
   * Clears all penalty upload history log entries
   */
  async clearAllPenaltyUploadBatches() {
    const text = `DELETE FROM penalty_upload_batches`;
    try {
      await db.query(text);
      inMemoryBatches.length = 0;
      return true;
    } catch (err) {
      if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        inMemoryBatches.length = 0;
        return true;
      }
      throw err;
    }
  }
}

module.exports = new PenaltyRepository();
