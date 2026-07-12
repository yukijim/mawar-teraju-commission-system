const db = require('../config/database');
const SimplePdfGenerator = require('../utils/pdfGenerator');
const auditLogService = require('./auditLogService');
const { AppError } = require('../middleware/error');

class ReportService {
  /**
   * Resolves a dispatcher's username to their mapping NRIC
   */
  async resolveDispatcherIc(username) {
    if (/^\d{12}$/.test(username)) {
      return username;
    }
    const mappingRes = await db.query(
      'SELECT ic_number FROM dispatcher_mappings WHERE dispatcher_id = $1',
      [username]
    );
    return mappingRes.rows[0]?.ic_number || null;
  }

  /**
   * Generates a Commission PDF Report
   */
  async generateCommissionReport(recordId, user, ipAddress, req) {
    // 1. Fetch record from database joined with batch details (Must be PUBLISHED)
    const queryText = `
      SELECT c.*, b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
      FROM commission_records c
      JOIN batches b ON c.batch_id = b.id
      WHERE c.id = $1 AND b.deleted_at IS NULL
    `;
    const result = await db.query(queryText, [recordId]);
    const record = result.rows[0];

    if (!record) {
      throw new AppError('Commission record not found.', 404, 'SEARCH_RECORD_NOT_FOUND');
    }

    // 2. Validate PUBLISHED batch constraint
    if (record.batch_status !== 'PUBLISHED') {
      throw new AppError('Requested report is not published yet.', 403, 'SEARCH_FORBIDDEN');
    }

    // 3. Security Role Check: Dispatcher can only download their own record
    if (user.role === 'DISPATCH') {
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc || record.ic_number !== resolvedIc) {
        throw new AppError('You are not authorized to download this report.', 403, 'SEARCH_FORBIDDEN');
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = SimplePdfGenerator.generateCommissionPdf(record, user.username, ipAddress);

    // 5. Log audit trail
    await auditLogService.logSuccessLogin(user.id, req, {
      action: 'GENERATE_PDF_COMMISSION',
      recordId,
      dispatcherId: record.dispatcher_id
    });

    return {
      filename: `Commission_Report_${record.dispatcher_id}_${record.month}_${record.year}.pdf`,
      buffer: pdfBuffer
    };
  }

  /**
   * Generates a Deduction Details PDF Report
   */
  async generateDeductionReport(recordId, user, ipAddress, req) {
    // 1. Fetch record from deduction_records joined with batches (Must be PUBLISHED)
    const queryText = `
      SELECT d.*, c.parcel_qty, c.net_parcel, c.exclude_extra_weight_yoyi, c.commission_rate, c.diff_rate_new_joiner,
             c.count_pickup, c.extra_weight_commission, c.total_commission, c.addition_pickup_commission,
             c.addition_fuel_allowance, c.addition_sorter, c.final_amount_to_pay, c.nett_commission,
             b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
      FROM deduction_records d
      JOIN batches b ON d.batch_id = b.id
      LEFT JOIN commission_records c ON d.batch_id = c.batch_id AND d.ic_number = c.ic_number
      WHERE d.id = $1 AND b.deleted_at IS NULL
    `;
    const result = await db.query(queryText, [recordId]);
    const record = result.rows[0];

    if (!record) {
      throw new AppError('Deduction record not found.', 404, 'SEARCH_RECORD_NOT_FOUND');
    }

    // 2. Validate PUBLISHED batch constraint
    if (record.batch_status !== 'PUBLISHED') {
      throw new AppError('Requested report is not published yet.', 403, 'SEARCH_FORBIDDEN');
    }

    // 3. Security Role Check: Dispatcher can only download their own record
    if (user.role === 'DISPATCH') {
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc || record.ic_number !== resolvedIc) {
        throw new AppError('You are not authorized to download this report.', 403, 'SEARCH_FORBIDDEN');
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = SimplePdfGenerator.generateDeductionPdf(record, user.username, ipAddress);

    // 5. Log audit trail
    await auditLogService.logSuccessLogin(user.id, req, {
      action: 'GENERATE_PDF_DEDUCTION',
      recordId,
      dispatcherId: record.dispatcher_id
    });

    return {
      filename: `Deduction_Report_${record.dispatcher_id}_${record.month}_${record.year}.pdf`,
      buffer: pdfBuffer
    };
  }
}

module.exports = new ReportService();
