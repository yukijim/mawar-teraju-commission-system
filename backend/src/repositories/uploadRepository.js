const db = require('../config/database');

/**
 * Repository layer for Excel Upload & Batch processing operations.
 * Upgraded to support Enterprise Batch Management features.
 */
class UploadRepository {
  /**
   * Finds a batch record by its SHA-256 file checksum
   * @param {string} checksum
   * @returns {Promise<object|null>}
   */
  async findBatchByChecksum(checksum) {
    const text = 'SELECT * FROM batches WHERE checksum = $1 AND deleted_at IS NULL';
    const result = await db.query(text, [checksum]);
    return result.rows[0] || null;
  }

  /**
   * Finds a batch record by its UUID
   * @param {string} batchId - UUID string
   * @returns {Promise<object|null>}
   */
  async findBatchById(batchId) {
    const text = 'SELECT * FROM batches WHERE id = $1 AND deleted_at IS NULL';
    const result = await db.query(text, [batchId]);
    return result.rows[0] || null;
  }

  /**
   * Retrieves all upload batches sorted by upload time desc (excluding soft-deleted batches)
   * @returns {Promise<Array<object>>}
   */
  async getUploadHistory() {
    const text = `
      SELECT b.*, u.username as uploader_name 
      FROM batches b
      JOIN users u ON b.uploaded_by = u.id
      WHERE b.deleted_at IS NULL
      ORDER BY b.uploaded_at DESC
    `;
    const result = await db.query(text);
    return result.rows;
  }

  /**
   * Performs soft deletion of a batch record (updates deleted_at / deleted_by / status)
   */
  async softDeleteBatch(client, batchId, userId) {
    const text = `
      UPDATE batches
      SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2, is_active = FALSE, status = 'ARCHIVED'
      WHERE id = $1
    `;
    await client.query(text, [batchId, userId]);
  }

  /**
   * Deletes a batch by ID using a transaction client (hard delete)
   * @param {object} client - pg pool client
   * @param {string} batchId - UUID string
   */
  async deleteBatchWithClient(client, batchId) {
    const text = 'DELETE FROM batches WHERE id = $1';
    await client.query(text, [batchId]);
  }

  /**
   * Inserts a new batch record inside a transaction
   */
  async createBatch(client, { id, name, month, year, status, active, filename, type, checksum, recordCount, uploadedBy, version = 1, previousBatchId = null, warnings = null }) {
    const text = `
      INSERT INTO batches (id, name, month, year, status, active, filename, type, checksum, record_count, uploaded_by, version, previous_batch_id, is_active, warnings)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const params = [id, name, month, year, status, active, filename, type, checksum, recordCount, uploadedBy, version, previousBatchId, active, warnings];
    const result = await client.query(text, params);
    return result.rows[0];
  }

  /**
   * Publishes a batch inside a transaction
   */
  async publishBatch(client, batchId, userId, previousBatchId = null) {
    const text = `
      UPDATE batches
      SET status = 'PUBLISHED', is_active = TRUE, published_at = CURRENT_TIMESTAMP, published_by = $2, previous_batch_id = $3
      WHERE id = $1
      RETURNING *
    `;
    const result = await client.query(text, [batchId, userId, previousBatchId]);
    return result.rows[0];
  }

  /**
   * Deactivates all other published batches for the same month/year inside a transaction
   */
  async deactivateOtherBatches(client, batchId, month, year) {
    const text = `
      UPDATE batches
      SET is_active = FALSE, status = 'ARCHIVED'
      WHERE id != $1 AND month = $2 AND year = $3 AND status = 'PUBLISHED' AND deleted_at IS NULL
    `;
    await client.query(text, [batchId, month, year]);
  }

  /**
   * Finds the latest active/published batch for a month/year to set as previous_batch_id
   */
  async findLatestActiveBatch(month, year) {
    const text = `
      SELECT id FROM batches 
      WHERE month = $1 AND year = $2 AND status = 'PUBLISHED' AND is_active = TRUE AND deleted_at IS NULL
      ORDER BY uploaded_at DESC 
      LIMIT 1
    `;
    const result = await db.query(text, [month, year]);
    return result.rows[0]?.id || null;
  }

  /**
   * Retrieves the current max version number for a batch period name
   */
  async getMaxVersionForPeriod(month, year) {
    const text = 'SELECT COALESCE(MAX(version), 0) as max_ver FROM batches WHERE month = $1 AND year = $2 AND deleted_at IS NULL';
    const result = await db.query(text, [month, year]);
    return parseInt(result.rows[0].max_ver, 10);
  }

  /**
   * Rolls back from target batch to its previous_batch_id inside a transaction
   */
  async executeRollback(client, batchId, previousBatchId, userId) {
    // 1. Deactivate current batch
    const decText = `
      UPDATE batches
      SET is_active = FALSE, status = 'ARCHIVED', deleted_at = CURRENT_TIMESTAMP, deleted_by = $2
      WHERE id = $1
    `;
    await client.query(decText, [batchId, userId]);

    // 2. Reactivate previous batch
    const actText = `
      UPDATE batches
      SET is_active = TRUE, status = 'PUBLISHED'
      WHERE id = $1
    `;
    await client.query(actText, [previousBatchId]);
  }

  /**
   * Bulk inserts dispatcher mappings using UPSERT (updates name and timestamp if dispatcher_id matches)
   */
  async upsertDispatcherMappings(client, mappings) {
    if (!mappings || mappings.length === 0) return;

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    mappings.forEach(m => {
      valuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
      values.push(m.dispatcher_id, m.ic_number, m.name);
      paramIndex += 3;
    });

    const text = `
      INSERT INTO dispatcher_mappings (dispatcher_id, ic_number, name)
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (dispatcher_id) 
      DO UPDATE SET 
        ic_number = EXCLUDED.ic_number,
        name = EXCLUDED.name,
        last_updated = CURRENT_TIMESTAMP
    `;
    await client.query(text, values);
  }

  /**
   * Bulk inserts commission records in a single transactional query
   */
  async bulkInsertCommissionRecords(client, batchId, records) {
    if (!records || records.length === 0) return;

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    records.forEach(r => {
      valuePlaceholders.push(`(
        $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3},
        $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7},
        $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11},
        $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15},
        $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}, $${paramIndex + 19},
        $${paramIndex + 20}, $${paramIndex + 21}, $${paramIndex + 22}, $${paramIndex + 23},
        $${paramIndex + 24}, $${paramIndex + 25}, $${paramIndex + 26}, $${paramIndex + 27},
        $${paramIndex + 28}
      )`);

      values.push(
        batchId, r.dispatcher_id, r.ic_number, r.name,
        r.parcel_qty || 0, r.net_parcel || 0, r.exclude_extra_weight_yoyi || 0, r.commission_rate || 0,
        r.diff_rate_new_joiner || 0, r.count_pickup || 0, r.extra_weight_commission || 0, r.total_commission || 0,
        r.addition_pickup_commission || 0, r.addition_fuel_allowance || 0, r.addition_sorter || 0,
        r.deduction_advance || 0, r.deduction_pending_cod || 0, r.deduction_hq_penalty || 0, r.deduction_duitnow_penalty || 0,
        r.deduction_late_cod_penalty || 0, r.deduction_lost_individual || 0, r.deduction_lost_parcel_hub || 0,
        r.nett_commission || 0, r.final_amount_to_pay || 0,
        r.system_reg || '', r.parcel_qty_jms || 0, r.status_payment || 'SUCCESS', r.date_payment || '', r.remark || ''
      );

      paramIndex += 29;
    });

    const text = `
      INSERT INTO commission_records (
        batch_id, dispatcher_id, ic_number, name,
        parcel_qty, net_parcel, exclude_extra_weight_yoyi, commission_rate,
        diff_rate_new_joiner, count_pickup, extra_weight_commission, total_commission,
        addition_pickup_commission, addition_fuel_allowance, addition_sorter,
        deduction_advance, deduction_pending_cod, deduction_hq_penalty, deduction_duitnow_penalty,
        deduction_late_cod_penalty, deduction_lost_individual, deduction_lost_parcel_hub,
        nett_commission, final_amount_to_pay,
        system_reg, parcel_qty_jms, status_payment, date_payment, remark
      )
      VALUES ${valuePlaceholders.join(', ')}
    `;
    await client.query(text, values);
  }

  /**
   * Bulk inserts deduction records in a single transactional query
   */
  async bulkInsertDeductionRecords(client, batchId, records) {
    if (!records || records.length === 0) return;

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    records.forEach(r => {
      valuePlaceholders.push(`(
        $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3},
        $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7},
        $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11},
        $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15},
        $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}
      )`);

      values.push(
        batchId, r.dispatcher_id, r.ic_number, r.name,
        r.deduction_advance || 0, r.deduction_pending_cod || 0, r.deduction_hq_penalty || 0, r.deduction_duitnow_penalty || 0,
        r.deduction_late_cod_penalty || 0, r.deduction_lost_individual || 0, r.deduction_lost_parcel_hub || 0,
        r.lost_pic_signed || 0, r.lost_rate || 0, r.total_all_lost_shared || 0, r.lost_parcel_pic_signed || 0,
        r.arbi_individual || 0, r.rcgen_penalty || 0, r.qc_penalty || 0, r.total_hq_penalty_detail || 0
      );

      paramIndex += 19;
    });

    const text = `
      INSERT INTO deduction_records (
        batch_id, dispatcher_id, ic_number, name,
        deduction_advance, deduction_pending_cod, deduction_hq_penalty, deduction_duitnow_penalty,
        deduction_late_cod_penalty, deduction_lost_individual, deduction_lost_parcel_hub,
        lost_pic_signed, lost_rate, total_all_lost_shared, lost_parcel_pic_signed,
        arbi_individual, rcgen_penalty, qc_penalty, total_hq_penalty_detail
      )
      VALUES ${valuePlaceholders.join(', ')}
    `;
    await client.query(text, values);
  }

  /**
   * Retrieves commission records for a specific batch
   * @param {string} batchId - UUID string
   * @returns {Promise<Array<object>>}
   */
  async getCommissionRecordsByBatch(batchId) {
    const text = 'SELECT * FROM commission_records WHERE batch_id = $1';
    const result = await db.query(text, [batchId]);
    return result.rows;
  }

  /**
   * Retrieves deduction records for a specific batch
   * @param {string} batchId - UUID string
   * @returns {Promise<Array<object>>}
   */
  async getDeductionRecordsByBatch(batchId) {
    const text = 'SELECT * FROM deduction_records WHERE batch_id = $1';
    const result = await db.query(text, [batchId]);
    return result.rows;
  }
}

module.exports = new UploadRepository();
