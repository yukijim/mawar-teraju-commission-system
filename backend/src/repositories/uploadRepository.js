const db = require('../config/database');

/**
 * Repository layer for Excel Upload & Batch processing operations.
 */
class UploadRepository {
  /**
   * Finds a batch record by its SHA-256 file checksum
   * @param {string} checksum
   * @returns {Promise<object|null>}
   */
  async findBatchByChecksum(checksum) {
    const text = 'SELECT * FROM batches WHERE checksum = $1';
    const result = await db.query(text, [checksum]);
    return result.rows[0] || null;
  }

  /**
   * Finds a batch record by its UUID
   * @param {string} batchId - UUID string
   * @returns {Promise<object|null>}
   */
  async findBatchById(batchId) {
    const text = 'SELECT * FROM batches WHERE id = $1';
    const result = await db.query(text, [batchId]);
    return result.rows[0] || null;
  }

  /**
   * Retrieves all upload batches sorted by upload time desc
   * @returns {Promise<Array<object>>}
   */
  async getUploadHistory() {
    const text = `
      SELECT b.*, u.username as uploader_name 
      FROM batches b
      JOIN users u ON b.uploaded_by = u.id
      ORDER BY b.uploaded_at DESC
    `;
    const result = await db.query(text);
    return result.rows;
  }

  /**
   * Deletes a batch by ID (used during overwriting or rollback)
   * @param {string} batchId - UUID string
   * @returns {Promise<boolean>}
   */
  async deleteBatch(batchId) {
    const text = 'DELETE FROM batches WHERE id = $1';
    const result = await db.query(text, [batchId]);
    return result.rowCount > 0;
  }

  /**
   * Deletes a batch by ID using a transaction client
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
  async createBatch(client, { name, month, year, status, active, filename, type, checksum, recordCount, uploadedBy }) {
    const text = `
      INSERT INTO batches (name, month, year, status, active, filename, type, checksum, record_count, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const params = [name, month, year, status, active, filename, type, checksum, recordCount, uploadedBy];
    const result = await client.query(text, params);
    return result.rows[0];
  }

  /**
   * Bulk inserts dispatcher mappings using UPSERT (updates name and timestamp if dispatcher_id matches)
   */
  async upsertDispatcherMappings(client, mappings) {
    if (!mappings || mappings.length === 0) return;

    // Build batch insert query with conflict updates
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
        $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}, $${paramIndex + 19},
        $${paramIndex + 20}
      )`);

      values.push(
        batchId, r.dispatcher_id, r.ic_number, r.name,
        r.deduction_advance || 0, r.deduction_pending_cod || 0, r.deduction_hq_penalty || 0, r.deduction_duitnow_penalty || 0,
        r.deduction_late_cod_penalty || 0, r.deduction_lost_individual || 0, r.deduction_lost_parcel_hub || 0,
        r.lost_pic_signed || 0, r.lost_rate || 0, r.total_all_lost_shared || 0, r.lost_parcel_pic_signed || 0,
        r.arbi_individual || 0, r.rcgen_penalty || 0, r.qc_penalty || 0, r.total_hq_penalty_detail || 0
      );

      paramIndex += 20;
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
