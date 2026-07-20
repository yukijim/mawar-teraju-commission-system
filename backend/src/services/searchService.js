const searchRepository = require('../repositories/searchRepository');
const auditLogService = require('./auditLogService');
const db = require('../config/database');
const { AppError } = require('../middleware/error');

class SearchService {
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
   * Executes securely filtered, paginated carian searches
   */
  async executeSearch(user, queryParams, ipAddress, req) {
    const startTime = Date.now();

    // 1. Pagination defaults
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = Math.min(parseInt(queryParams.limit, 10) || 10, 100); // Caps limit at 100
    const offset = (page - 1) * limit;

    // Filters
    const month = queryParams.month ? parseInt(queryParams.month, 10) : null;
    const year = queryParams.year ? parseInt(queryParams.year, 10) : null;
    const version = queryParams.version ? parseInt(queryParams.version, 10) : null;

    const sort = queryParams.sort || 'name';
    const order = queryParams.order === 'DESC' ? 'DESC' : 'ASC';

    let icNumber = queryParams.ic_number ? queryParams.ic_number.replace(/[\s-]/g, '') : null;
    let dispatcherId = queryParams.dispatcher_id || null;
    let batchId = queryParams.batch_id || null;

    let status = null;
    let is_active = undefined;

    // 2. Role-Based Search Guards
    if (!user) {
      // Public search (no login): enforce PUBLISHED and active batches only
      status = 'PUBLISHED';
      is_active = true;
      // Must provide NRIC/IC or Dispatcher ID
      if (!icNumber && !dispatcherId) {
        throw new AppError('Nombor IC, Passport, atau ID Dispatcher diperlukan untuk carian awam.', 400, 'SEARCH_VALIDATION_ERROR');
      }
    } else if (user.role === 'DISPATCH') {
      // Dispatcher queries MUST only use ACTIVE and PUBLISHED batches
      status = 'PUBLISHED';
      is_active = true;

      // Dispatcher can only query their own records!
      const resolvedIc = await this.resolveDispatcherIc(user.username);
      if (!resolvedIc) {
        throw new AppError('Dispatcher profile mapping is incomplete.', 403, 'SEARCH_MAPPING_INCOMPLETE');
      }
      icNumber = resolvedIc;
      dispatcherId = null; // Ignore external dispatcher query parameter
      batchId = null;      // Ignore external batch query parameter
    } else if (user.role === 'ADMIN') {
      // Admin can search optionally by status and active state
      status = queryParams.status || null;
      if (queryParams.is_active !== undefined) {
        is_active = queryParams.is_active === 'true';
      }
    }

    // 2.1 Verify batch exists if batchId is provided
    if (batchId) {
      const batchRes = await db.query('SELECT id FROM batches WHERE id = $1 AND deleted_at IS NULL', [batchId]);
      if (batchRes.rows.length === 0) {
        throw new AppError('Requested batch period does not exist.', 404, 'UPLOAD_BATCH_NOT_FOUND');
      }
    }

    // 3. Execute database query
    const { records, totalRecords } = await searchRepository.searchCommissions({
      icNumber,
      dispatcherId,
      batchId,
      status,
      is_active,
      month,
      year,
      version,
      sort,
      order,
      limit,
      offset
    });

    if (records.length === 0) {
      throw new AppError('No commission records found matching search filters.', 404, 'SEARCH_RECORD_NOT_FOUND');
    }

    const totalPages = Math.ceil(totalRecords / limit);
    const duration = Date.now() - startTime;

    // 4. Log search to search_history
    await searchRepository.createSearchHistory({
      userId: user ? user.id : null,
      icNumber: icNumber || queryParams.ic_number,
      dispatcherId: dispatcherId || queryParams.dispatcher_id,
      duration,
      ipAddress
    });

    // 5. Log audit action
    if (user) {
      await auditLogService.logSuccessLogin(user.id, req, {
        action: 'COMMISSION_SEARCH',
        query: { icNumber, dispatcherId, batchId },
        duration
      });
    } else {
      await auditLogService.logSuccessLogin(null, req, {
        action: 'PUBLIC_COMMISSION_SEARCH',
        query: { icNumber, dispatcherId, batchId },
        duration
      });
    }

    // 6. Format responses to partition Dispatcher Info, Commission, and Deductions
    const formattedRecords = records.map(r => ({
      dispatcherInfo: {
        dispatcherId: r.dispatcher_id,
        icNumber: r.ic_number,
        name: r.name
      },
      commission: {
        id: r.id,
        parcelQty: r.parcel_qty,
        netParcel: r.net_parcel,
        excludeExtraWeightYoyi: r.exclude_extra_weight_yoyi,
        commissionRate: parseFloat(r.commission_rate),
        diffRateNewJoiner: parseFloat(r.diff_rate_new_joiner),
        countPickup: r.count_pickup,
        extraWeightCommission: parseFloat(r.extra_weight_commission),
        totalCommission: parseFloat(r.total_commission),
        additionPickupCommission: parseFloat(r.addition_pickup_commission),
        additionRefundPenalty: parseFloat(r.addition_refund_penalty),
        additionSorter: parseFloat(r.addition_sorter),
        additionOthers: parseFloat(r.addition_others),
        additionExtraReward: parseFloat(r.addition_extra_reward || 0),
        statusPayment: r.status_payment,
        datePayment: r.date_payment,
        remark: r.remark
      },
      deduction: {
        id: r.deduction_record_id,
        deductionOthers: parseFloat(r.deduction_others),
        deductionPendingCod: parseFloat(r.deduction_pending_cod),
        deductionHqPenalty: parseFloat(r.deduction_hq_penalty),
        deductionDuitnowPenalty: parseFloat(r.deduction_duitnow_penalty),
        deductionLateCodPenalty: parseFloat(r.deduction_late_cod_penalty),
        deductionLostIndividual: parseFloat(r.deduction_lost_individual),
        deductionLostParcelHub: parseFloat(r.deduction_lost_parcel_hub),
        lostPicSigned: parseFloat(r.lost_pic_signed || 0),
        lostRate: parseFloat(r.lost_rate || 0),
        totalAllLostShared: parseFloat(r.total_all_lost_shared || 0),
        lostParcelPicSigned: parseFloat(r.lost_parcel_pic_signed || 0),
        arbiIndividual: parseFloat(r.arbi_individual || 0),
        rcgenPenalty: parseFloat(r.rcgen_penalty || 0),
        qcPenalty: parseFloat(r.qc_penalty || 0),
        totalHqPenaltyDetail: parseFloat(r.total_hq_penalty_detail || 0)
      },
      netAmount: {
        nettCommission: parseFloat(r.nett_commission),
        finalAmountToPay: parseFloat(r.final_amount_to_pay)
      },
      batchInfo: {
        batchId: r.batch_id,
        batchName: r.batch_name,
        month: r.month,
        year: r.year,
        batchStatus: r.batch_status,
        isActive: r.is_active,
        batchVersion: r.version,
        publishedDate: r.published_at
      }
    }));

    return {
      records: formattedRecords,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    };
  }

  /**
   * Retrieves full search log history for administrators
   */
  async getSearchHistory(user, req) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only administrators can access search history records.', 403, 'SEARCH_FORBIDDEN');
    }
    const logs = await searchRepository.getSearchHistory();
    await auditLogService.logSuccessLogin(user.id, req, { action: 'VIEW_SEARCH_HISTORY' });
    return logs;
  }

  /**
   * Exports Architecture Hooks (Placeholders preparing downstream generators)
   */
  preparePdfExport(record) {
    console.log('[Export Engine] Formatting payload stream for PDF layout generator...');
    return {
      template: 'MAROON_COMMISSION_OR_GOLD_DEDUCTION',
      data: record,
      generatedAt: new Date().toISOString()
    };
  }

  prepareExcelExport(records) {
    console.log('[Export Engine] Buffering sheet matrix cells for xlsx download...');
    return {
      template: 'COMMISSION_SHEET_GRID',
      recordsCount: records.length,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new SearchService();
