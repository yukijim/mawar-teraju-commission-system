const crypto = require('crypto');
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
    // 1. Fetch record from database joined with batch details and deduction records
    const queryText = `
      SELECT 
        c.*, 
        COALESCE(d.deduction_advance, 0) as deduction_advance,
        COALESCE(d.deduction_pending_cod, 0) as deduction_pending_cod,
        COALESCE(d.deduction_hq_penalty, 0) as deduction_hq_penalty,
        COALESCE(d.deduction_duitnow_penalty, 0) as deduction_duitnow_penalty,
        COALESCE(d.deduction_late_cod_penalty, 0) as deduction_late_cod_penalty,
        COALESCE(d.deduction_lost_individual, 0) as deduction_lost_individual,
        COALESCE(d.deduction_lost_parcel_hub, 0) as deduction_lost_parcel_hub,
        b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
      FROM commission_records c
      JOIN batches b ON c.batch_id = b.id
      LEFT JOIN batches b2 ON b.name = b2.name AND b2.type = 'DEDUCTION' AND b2.status = 'PUBLISHED' AND b2.version = b.version
      LEFT JOIN deduction_records d ON b2.id = d.batch_id AND c.dispatcher_id = d.dispatcher_id
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
    if (user && user.role === 'DISPATCH') {
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc || record.ic_number !== resolvedIc) {
        throw new AppError('You are not authorized to download this report.', 403, 'SEARCH_FORBIDDEN');
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = SimplePdfGenerator.generateCommissionPdf(record, user ? user.username : 'PUBLIC_VISITOR', ipAddress);

    // Calculate unique reference number
    const refNum = `REF-${record.batch_id.substring(0, 8).toUpperCase()}-${crypto.createHash('sha256').update(record.ic_number).digest('hex').substring(0, 8).toUpperCase()}`;

    // 5. Log audit trail with precise parameters
    if (user) {
      await auditLogService.logSuccessLogin(user.id, req, {
        action: 'COMMISSION_PDF_DOWNLOADED',
        recordId,
        dispatcherId: record.dispatcher_id,
        referenceNumber: refNum,
        ipAddress,
        time: new Date().toISOString(),
        user: { id: user.id, username: user.username, role: user.role }
      });
    } else {
      await auditLogService.logSuccessLogin(null, req, {
        action: 'PUBLIC_COMMISSION_PDF_DOWNLOADED',
        recordId,
        dispatcherId: record.dispatcher_id,
        referenceNumber: refNum,
        ipAddress,
        time: new Date().toISOString(),
        user: { id: null, username: 'public_visitor', role: 'PUBLIC' }
      });
    }

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
             c.addition_refund_penalty, c.addition_others, c.addition_sorter, c.final_amount_to_pay, c.nett_commission,
             b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
      FROM deduction_records d
      JOIN batches b ON d.batch_id = b.id
      LEFT JOIN batches b2 ON b.name = b2.name AND b2.type = 'COMMISSION' AND b2.status = 'PUBLISHED' AND b2.version = b.version
      LEFT JOIN commission_records c ON b2.id = c.batch_id AND d.dispatcher_id = c.dispatcher_id
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
    if (user && user.role === 'DISPATCH') {
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc || record.ic_number !== resolvedIc) {
        throw new AppError('You are not authorized to download this report.', 403, 'SEARCH_FORBIDDEN');
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = SimplePdfGenerator.generateDeductionPdf(record, user ? user.username : 'PUBLIC_VISITOR', ipAddress);

    // Calculate unique reference number
    const refNum = `REF-${record.batch_id.substring(0, 8).toUpperCase()}-${crypto.createHash('sha256').update(record.ic_number).digest('hex').substring(0, 8).toUpperCase()}`;

    // 5. Log audit trail with precise parameters
    if (user) {
      await auditLogService.logSuccessLogin(user.id, req, {
        action: 'DEDUCTION_PDF_DOWNLOADED',
        recordId,
        dispatcherId: record.dispatcher_id,
        referenceNumber: refNum,
        ipAddress,
        time: new Date().toISOString(),
        user: { id: user.id, username: user.username, role: user.role }
      });
    } else {
      await auditLogService.logSuccessLogin(null, req, {
        action: 'PUBLIC_DEDUCTION_PDF_DOWNLOADED',
        recordId,
        dispatcherId: record.dispatcher_id,
        referenceNumber: refNum,
        ipAddress,
        time: new Date().toISOString(),
        user: { id: null, username: 'public_visitor', role: 'PUBLIC' }
      });
    }

    return {
      filename: `Deduction_Report_${record.dispatcher_id}_${record.month}_${record.year}.pdf`,
      buffer: pdfBuffer
    };
  }
}

module.exports = new ReportService();
