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
             c.addition_refund_penalty, c.addition_others, c.addition_sorter, c.addition_extra_reward, c.final_amount_to_pay, c.nett_commission,
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

  /**
   * Generates a Combined Commission & Deduction PDF Report
   */
  async generateCombinedReport(commissionId, deductionId, user, ipAddress, req) {
    let record = null;
    
    if (commissionId && commissionId !== 'none') {
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
      const result = await db.query(queryText, [commissionId]);
      record = result.rows[0];
    } else if (deductionId && deductionId !== 'none') {
      const queryText = `
        SELECT 
          d.*,
          COALESCE(c.parcel_qty, 0) as parcel_qty,
          COALESCE(c.net_parcel, 0) as net_parcel,
          COALESCE(c.exclude_extra_weight_yoyi, 0) as exclude_extra_weight_yoyi,
          COALESCE(c.commission_rate, 0) as commission_rate,
          COALESCE(c.diff_rate_new_joiner, 0) as diff_rate_new_joiner,
          COALESCE(c.count_pickup, 0) as count_pickup,
          COALESCE(c.extra_weight_commission, 0) as extra_weight_commission,
          COALESCE(c.total_commission, 0) as total_commission,
          COALESCE(c.addition_pickup_commission, 0) as addition_pickup_commission,
          COALESCE(c.addition_refund_penalty, 0) as addition_refund_penalty,
          COALESCE(c.addition_others, 0) as addition_others,
          COALESCE(c.addition_sorter, 0) as addition_sorter,
          COALESCE(c.addition_extra_reward, 0) as addition_extra_reward,
          COALESCE(c.nett_commission, 0) as nett_commission,
          COALESCE(c.final_amount_to_pay, 0) as final_amount_to_pay,
          b.name as batch_name, b.month, b.year, b.status as batch_status, b.is_active, b.version, b.published_at
        FROM deduction_records d
        JOIN batches b ON d.batch_id = b.id
        LEFT JOIN batches b2 ON b.name = b2.name AND b2.type = 'COMMISSION' AND b2.status = 'PUBLISHED' AND b2.version = b.version
        LEFT JOIN commission_records c ON b2.id = c.batch_id AND d.dispatcher_id = c.dispatcher_id
        WHERE d.id = $1 AND b.deleted_at IS NULL
      `;
      const result = await db.query(queryText, [deductionId]);
      record = result.rows[0];
    }

    if (!record) {
      throw new AppError('Combined record not found.', 404, 'SEARCH_RECORD_NOT_FOUND');
    }

    // 2. Validate PUBLISHED batch constraint
    if (record.batch_status !== 'PUBLISHED') {
      throw new AppError('Requested report is not published yet.', 403, 'SEARCH_FORBIDDEN');
    }

    // 3. Security Role Check
    if (user && user.role === 'DISPATCH') {
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc || record.ic_number !== resolvedIc) {
        throw new AppError('You are not authorized to download this report.', 403, 'SEARCH_FORBIDDEN');
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = SimplePdfGenerator.generateCombinedPdf(record, user ? user.username : 'PUBLIC_VISITOR', ipAddress);

    // Calculate unique reference number
    const refNum = `REF-${record.batch_id.substring(0, 8).toUpperCase()}-${crypto.createHash('sha256').update(record.ic_number).digest('hex').substring(0, 8).toUpperCase()}`;

    // 5. Log audit trail
    const auditData = {
      action: user ? 'COMBINED_PDF_DOWNLOADED' : 'PUBLIC_COMBINED_PDF_DOWNLOADED',
      commissionId: commissionId !== 'none' ? commissionId : null,
      deductionId: deductionId !== 'none' ? deductionId : null,
      dispatcherId: record.dispatcher_id,
      referenceNumber: refNum,
      ipAddress,
      time: new Date().toISOString(),
      user: user ? { id: user.id, username: user.username, role: user.role } : { id: null, username: 'public_visitor', role: 'PUBLIC' }
    };
    await auditLogService.logSuccessLogin(user ? user.id : null, req, auditData);

    return {
      filename: `Commission_Report_Combined_${record.dispatcher_id}_${record.month}_${record.year}.pdf`,
      buffer: pdfBuffer
    };
  }
}

module.exports = new ReportService();
