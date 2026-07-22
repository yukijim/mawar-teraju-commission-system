const searchRepository = require('../repositories/searchRepository');
const penaltyRepository = require('../repositories/penaltyRepository');
const auditLogService = require('./auditLogService');
const db = require('../config/database');
const { AppError } = require('../middleware/error');

class SearchService {
  /**
   * Resolves a dispatcher's username to their mapping NRIC
   */
  async resolveDispatcherIc(username) {
    const clean = username.toString().trim().toUpperCase();
    
    // First, check if clean is a dispatcher_id in mappings
    const idRes = await db.query(
      'SELECT ic_number FROM dispatcher_mappings WHERE UPPER(dispatcher_id) = $1',
      [clean]
    );
    if (idRes.rows.length > 0) {
      return idRes.rows[0].ic_number;
    }
    
    // If not found as dispatcher_id, check if it exists as ic_number in mappings
    const icRes = await db.query(
      'SELECT ic_number FROM dispatcher_mappings WHERE UPPER(ic_number) = $1',
      [clean]
    );
    if (icRes.rows.length > 0) {
      return icRes.rows[0].ic_number;
    }
    
    // Fallback to check standard NRIC or Passport formats
    if (/^\d{12}$/.test(clean) || /^[A-Z]\d{7,8}$/i.test(clean)) {
      return clean;
    }
    
    return null;
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
      console.error('=== SEARCH FAILURE DIAGNOSTICS ===');
      console.error(`Query parameters: ${JSON.stringify(queryParams)}`);
      console.error(`Resolved search parameters: icNumber="${icNumber}", dispatcherId="${dispatcherId}", batchId="${batchId}", status="${status}", is_active=${is_active}, month=${month}, year=${year}, version=${version}`);
      
      try {
        // Let's check if the dispatcher exists at all in mappings
        const mappingCheck = await db.query(
          'SELECT * FROM dispatcher_mappings WHERE UPPER(dispatcher_id) = $1 OR UPPER(ic_number) = $2',
          [(queryParams.dispatcher_id || '').toString().toUpperCase(), (queryParams.ic_number || '').toString().toUpperCase()]
        );
        console.error(`Dispatcher mapping records found in DB: ${JSON.stringify(mappingCheck.rows)}`);
        
        // Check if any commission records exist for this dispatcher
        const commCheck = await db.query(
          'SELECT id, batch_id, dispatcher_id, ic_number FROM commission_records WHERE UPPER(dispatcher_id) = $1 OR UPPER(ic_number) = $2 LIMIT 5',
          [(dispatcherId || queryParams.dispatcher_id || '').toString().toUpperCase(), (icNumber || queryParams.ic_number || '').toString().toUpperCase()]
        );
        console.error(`Commission records found in DB: ${JSON.stringify(commCheck.rows)}`);
        
        // Check active batches
        const activeBatches = await db.query(
          'SELECT id, name, month, year, status, is_active, type FROM batches WHERE deleted_at IS NULL'
        );
        console.error(`Active batches in DB: ${JSON.stringify(activeBatches.rows)}`);
      } catch (logErr) {
        console.error(`Diagnostic logging failed: ${logErr.message}`);
      }
      console.error('==================================');

      throw new AppError(`No commission records found matching search filters (IC: ${icNumber || 'N/A'}, ID: ${dispatcherId || 'N/A'}).`, 404, 'SEARCH_RECORD_NOT_FOUND');
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
    const formattedRecords = await Promise.all(records.map(async (r) => {
      let pSum = { fake_return: 0, fake_problematic: 0, fraud_delivery: 0, arbitration: 0, individual_lost: 0 };
      try {
        pSum = (await penaltyRepository.getPenaltySummary(r.dispatcher_id)) || pSum;
      } catch (pErr) {
        console.warn(`[SearchService] Error loading penalty summary for ${r.dispatcher_id}:`, pErr.message);
      }

      return {
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
        penaltySummary: {
          fakeReturn: parseFloat(pSum.fake_return || 0),
          fakeProblematic: parseFloat(pSum.fake_problematic || 0),
          fraudDelivery: parseFloat(pSum.fraud_delivery || 0),
          arbitration: parseFloat(pSum.arbitration || 0),
          individualLost: parseFloat(pSum.individual_lost || 0)
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
      };
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
