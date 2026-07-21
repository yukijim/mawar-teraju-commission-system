const db = require('../config/database');

/**
 * Repository layer for execution of Enterprise Commission Search queries.
 * Enforces whitelisted sorting columns, prepared SQL statements, and index matches.
 */
class SearchRepository {
  // Whitelist to prevent SQL Injection in ORDER BY clauses
  ALLOWED_SORT_COLUMNS = {
    name: 'c.name',
    ic_number: 'c.ic_number',
    dispatcher_id: 'c.dispatcher_id',
    final_amount_to_pay: 'c.final_amount_to_pay',
    nett_commission: 'c.nett_commission',
    parcel_qty: 'c.parcel_qty',
    month: 'b.month',
    year: 'b.year',
    version: 'b.version'
  };

  /**
   * Executes parameterized search queries on Joined records
   */
  async searchCommissions({ icNumber, dispatcherId, batchId, status, is_active, month, year, version, sort, order, limit, offset }) {
    let queryText = `
      SELECT 
        c.*, 
        d.id as deduction_record_id,
        d.deduction_others, d.deduction_pending_cod, d.deduction_hq_penalty, d.deduction_duitnow_penalty,
        d.deduction_late_cod_penalty, d.deduction_lost_individual, d.deduction_lost_parcel_hub,
        d.lost_pic_signed, d.lost_rate, d.total_all_lost_shared, d.lost_parcel_pic_signed,
        d.arbi_individual, d.rcgen_penalty, d.qc_penalty, d.total_hq_penalty_detail,
        b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
      FROM commission_records c
      JOIN batches b ON c.batch_id = b.id
      LEFT JOIN batches b2 ON b.month = b2.month AND b.year = b2.year AND b2.type = 'DEDUCTION' AND b2.deleted_at IS NULL AND (
        (b.status = 'PUBLISHED' AND b2.status = 'PUBLISHED' AND b2.is_active = TRUE)
        OR
        (b.status != 'PUBLISHED' AND b2.status = b.status AND b2.version = b.version AND b.name = b2.name)
      )
      LEFT JOIN deduction_records d ON b2.id = d.batch_id AND c.dispatcher_id = d.dispatcher_id
      WHERE b.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    // Apply main query filters with dispatcher mapping fallback
    if (icNumber) {
      queryText += ` AND (c.ic_number = $${paramIndex} OR c.dispatcher_id IN (SELECT dispatcher_id FROM dispatcher_mappings WHERE ic_number = $${paramIndex}))`;
      params.push(icNumber);
      paramIndex++;
    }

    if (dispatcherId) {
      queryText += ` AND (c.dispatcher_id = $${paramIndex} OR c.ic_number IN (SELECT ic_number FROM dispatcher_mappings WHERE dispatcher_id = $${paramIndex}))`;
      params.push(dispatcherId);
      paramIndex++;
    }

    if (batchId) {
      queryText += ` AND c.batch_id = $${paramIndex}`;
      params.push(batchId);
      paramIndex++;
    }

    // Apply batch lifecycle filters (e.g. status='PUBLISHED')
    if (status) {
      queryText += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (is_active !== undefined) {
      queryText += ` AND b.is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;
    }

    // Apply metadata filters
    if (month) {
      queryText += ` AND b.month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    if (year) {
      queryText += ` AND b.year = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    if (version) {
      queryText += ` AND b.version = $${paramIndex}`;
      params.push(version);
      paramIndex++;
    }

    // Validate and build ORDER BY sorting clauses safely
    const sortColumn = this.ALLOWED_SORT_COLUMNS[sort] || 'c.name';
    const sortOrder = order === 'DESC' ? 'DESC' : 'ASC';
    queryText += ` ORDER BY ${sortColumn} ${sortOrder}`;

    // Apply pagination
    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(queryText, params);

    // Run a parallel COUNT query for pagination meta totals
    let countQueryText = `
      SELECT COUNT(c.id) as total_count
      FROM commission_records c
      JOIN batches b ON c.batch_id = b.id
      WHERE b.deleted_at IS NULL
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (icNumber) {
      countQueryText += ` AND (c.ic_number = $${countParamIndex} OR c.dispatcher_id IN (SELECT dispatcher_id FROM dispatcher_mappings WHERE ic_number = $${countParamIndex}))`;
      countParams.push(icNumber);
      countParamIndex++;
    }
    if (dispatcherId) {
      countQueryText += ` AND (c.dispatcher_id = $${countParamIndex} OR c.ic_number IN (SELECT ic_number FROM dispatcher_mappings WHERE dispatcher_id = $${countParamIndex}))`;
      countParams.push(dispatcherId);
      countParamIndex++;
    }
    if (batchId) {
      countQueryText += ` AND c.batch_id = $${countParamIndex}`;
      countParams.push(batchId);
      countParamIndex++;
    }
    if (status) {
      countQueryText += ` AND b.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (is_active !== undefined) {
      countQueryText += ` AND b.is_active = $${countParamIndex}`;
      countParams.push(is_active);
      countParamIndex++;
    }
    if (month) {
      countQueryText += ` AND b.month = $${countParamIndex}`;
      countParams.push(month);
      countParamIndex++;
    }
    if (year) {
      countQueryText += ` AND b.year = $${countParamIndex}`;
      countParams.push(year);
      countParamIndex++;
    }
    if (version) {
      countQueryText += ` AND b.version = $${countParamIndex}`;
      countParams.push(version);
      countParamIndex++;
    }

    const countResult = await db.query(countQueryText, countParams);
    const totalRecords = parseInt(countResult.rows[0].total_count, 10);

    return {
      records: result.rows,
      totalRecords
    };
  }

  /**
   * Saves a new search logging trace inside search_history table
   */
  async createSearchHistory({ userId, icNumber, dispatcherId, duration, ipAddress }) {
    const text = `
      INSERT INTO search_history (user_id, ic_number, dispatcher_id, duration, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const params = [userId || null, icNumber || null, dispatcherId || null, duration, ipAddress || 'unknown'];
    const result = await db.query(text, params);
    return result.rows[0];
  }

  /**
   * Retrieves full search log logs list
   */
  async getSearchHistory() {
    const text = `
      SELECT s.*, u.username as searcher_name
      FROM search_history s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `;
    const result = await db.query(text);
    return result.rows;
  }
}

module.exports = new SearchRepository();
