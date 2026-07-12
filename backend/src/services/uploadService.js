const crypto = require('crypto');
const XLSX = require('xlsx');
const db = require('../config/database');
const uploadRepository = require('../repositories/uploadRepository');
const auditLogService = require('./auditLogService');
const { AppError } = require('../middleware/error');

/**
 * Normalizes an Excel column header string for lookup.
 */
const normalizeHeader = (str) => {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Parses numeric values safely from cell data.
 */
const parseNumericValue = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const cleanVal = val.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanVal);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Dynamically scans cells to find the header row by searching for "delivery dispatcher id".
 */
const getSheetRows = (sheet) => {
  if (!sheet || !sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  let headerRowIdx = range.s.r;
  
  for (let r = range.s.r; r <= range.e.r; r++) {
    let found = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellRef];
      if (cell && cell.v && cell.v.toString().toLowerCase().includes('delivery dispatcher id')) {
        found = true;
        break;
      }
    }
    if (found) {
      headerRowIdx = r;
      break;
    }
  }
  // raw: false ensures we read the formatted display string value (calculated formula result)
  return XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '', raw: false });
};

class UploadService {
  // Mapping rules matching excel.js
  COMMISSION_MAPPING_RULES = {
    dispatcher_id: ['delivery dispatcher id', 'dispatcher id', 'id dispatcher', 'id'],
    name: ['delivery dispatcher name', 'nama', 'name', 'nama penuh', 'fullname', 'full name', 'dispatch'],
    parcel_qty: ['parcel quantity', 'parcel qty', 'bilangan parcel', 'jumlah parcel'],
    net_parcel: ['net parcel'],
    exclude_extra_weight_yoyi: ['exclude extra weight yoyi'],
    commission_rate: ['rm1.11/parcel commission', 'rm1.11 / parcel commission', 'rm1.11/parcel commission', 'commission', 'komisen'],
    diff_rate_new_joiner: ['diff rate new joiner', 'diff rate new joiner '],
    count_pickup: ['count of pick up dispatcher name', 'count of pick up'],
    extra_weight_commission: ['extra weight commission', 'extra weight commission (=>5.01kg, add rm0.10/kg)'],
    total_commission: ['total commission'],
    deduction_advance: ['deduction: advance', 'deduction: advance ', 'deduction advance'],
    deduction_pending_cod: ['deduction: pending cod', 'deduction: pending cod ', 'deduction pending cod'],
    deduction_hq_penalty: ['deduction: hq penalty', 'deduction: hq penalty ', 'deduction hq penalty'],
    deduction_duitnow_penalty: ['deduction: duitnow penalty', 'deduction: duitnow penalty ', 'deduction duitnow penalty'],
    deduction_late_cod_penalty: ['deduction: late cod penalty', 'deduction: late cod penalty ', 'deduction late cod penalty'],
    deduction_lost_individual: ['deduction: lost individual', 'deduction: lost individual ', 'deduction lost individual'],
    deduction_lost_parcel_hub: ['deduction: lost parcel hub', 'deduction: lost parcel hub ', 'deduction lost parcel hub'],
    addition_pickup_commission: ['add: pickup commission', 'addition: pickup commission', 'pickup commission'],
    addition_fuel_allowance: ['add: fuel allowance', 'fuel allowance'],
    addition_sorter: ['add: sorter', 'sorter'],
    nett_commission: ['nett commission', 'net commission'],
    final_amount_to_pay: ['final amount to pay', 'amount to pay'],
    system_reg: ['system reg', 'system reg ', 'system_reg'],
    ic_number: ['count digit', 'no ic', 'no. ic', 'nric', 'ic number', 'ic'],
    parcel_qty_jms: ['parcel qty jms'],
    status_payment: ['status', 'status_payment'],
    date_payment: ['date payment', 'date payment ', 'date_payment'],
    remark: ['remark farisha', 'remark']
  };

  DEDUCTION_MAPPING_RULES = {
    dispatcher_id: ['delivery dispatcher id', 'dispatcher id', 'id dispatcher', 'id'],
    name: ['delivery dispatcher name', 'nama', 'name', 'nama penuh'],
    lost_pic_signed: ['lost pic signed', 'lost pic signed '],
    lost_rate: ['lost rate'],
    total_all_lost_shared: ['total all lost shared', 'total all lost shared '],
    lost_parcel_pic_signed: ['lost parcel pic signed'],
    arbi_individual: ['arbi individual'],
    rcgen_penalty: ['rcgen 03.07.26', 'rcgen'],
    qc_penalty: ['qc'],
    total_hq_penalty_detail: ['total hq penalty', 'total hq penalty ']
  };

  /**
   * Calculates SHA-256 checksum of a buffer
   */
  calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Imports a Commission Excel sheet
   */
  async importCommission(fileBuffer, filename, uploaderId, reqBody, req) {
    const startTime = Date.now();
    const checksum = this.calculateChecksum(fileBuffer);

    const month = parseInt(reqBody.month);
    const year = parseInt(reqBody.year);
    const batchName = reqBody.name || `Commission ${month}/${year}`;
    const overwrite = reqBody.overwrite === 'true' || reqBody.overwrite === true;

    if (!month || !year) {
      throw new AppError('Month and Year are required fields.', 400, 'UPLOAD_VALIDATION_ERROR');
    }

    // Start Audit Log
    await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_STARTED', filename, type: 'COMMISSION' });

    // 1. Check duplicate
    const existingBatch = await uploadRepository.findBatchByChecksum(checksum);
    if (existingBatch) {
      if (!overwrite) {
        await auditLogService.logFailedLogin(reqBody.username || 'unknown', req, { action: 'UPLOAD_FAILED', reason: 'Duplicate file checksum', filename });
        throw new AppError('This file has already been uploaded.', 409, 'UPLOAD_DUPLICATE_FILE');
      }
      // Overwrite requires ADMIN role
      if (req.user.role !== 'ADMIN') {
        await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: 'Non-admin attempted overwrite', filename });
        throw new AppError('Only administrators are allowed to overwrite uploaded batches.', 403, 'UPLOAD_FORBIDDEN');
      }
    }

    // 2. Parse workbook securely
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const sheetNames = workbook.SheetNames;
    const commSheetName = sheetNames.find(n => n.toLowerCase().includes('dispatcher comm') || n.toLowerCase().includes('comm'));
    if (!commSheetName) {
      throw new AppError('Lembaran "Dispatcher Comm" tidak dijumpai dalam fail Excel.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const commSheet = workbook.Sheets[commSheetName];
    const commRows = getSheetRows(commSheet);
    if (commRows.length === 0) {
      throw new AppError('Sheet "Dispatcher Comm" is empty or contains no records.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    // Map headers dynamically
    const firstRow = commRows[0];
    const commHeadersMap = {};
    Object.keys(this.COMMISSION_MAPPING_RULES).forEach(key => {
      commHeadersMap[key] = null;
    });

    Object.keys(firstRow).forEach(header => {
      const cleanHeader = normalizeHeader(header);
      for (const [key, aliases] of Object.entries(this.COMMISSION_MAPPING_RULES)) {
        if (!commHeadersMap[key] && aliases.includes(cleanHeader)) {
          commHeadersMap[key] = header;
          break;
        }
      }
    });

    // Validate required fields
    const requiredCommKeys = ['dispatcher_id', 'ic_number', 'name', 'parcel_qty', 'net_parcel', 'commission_rate', 'total_commission', 'nett_commission', 'final_amount_to_pay'];
    const missingFields = requiredCommKeys.filter(key => !commHeadersMap[key]);
    if (missingFields.length > 0) {
      throw new AppError(`Missing required template columns: ${missingFields.join(', ')}`, 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    // 3. Process rows and extract mappings
    const dispatcherMappings = [];
    const commissionRecords = [];
    const processedIcs = new Set();

    let recordsImported = 0;
    let recordsSkipped = 0;
    let duplicates = 0;
    let errors = 0;

    commRows.forEach(row => {
      try {
        const rawId = row[commHeadersMap.dispatcher_id];
        const rawIc = row[commHeadersMap.ic_number];
        const rawName = row[commHeadersMap.name];

        if (!rawId || rawId.toString().trim() === '') {
          recordsSkipped++;
          return;
        }

        const dispatcher_id = rawId.toString().trim();
        const ic_number = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
        const name = rawName ? rawName.toString().trim() : '';

        if (!ic_number || ic_number.length < 9) {
          recordsSkipped++;
          return;
        }

        // Detect duplicate NRICs in spreadsheet
        if (processedIcs.has(ic_number)) {
          duplicates++;
          return;
        }
        processedIcs.add(ic_number);

        dispatcherMappings.push({ dispatcher_id, ic_number, name });

        commissionRecords.push({
          dispatcher_id,
          ic_number,
          name,
          parcel_qty: parseInt(row[commHeadersMap.parcel_qty]) || 0,
          net_parcel: parseInt(row[commHeadersMap.net_parcel]) || 0,
          exclude_extra_weight_yoyi: parseInt(row[commHeadersMap.exclude_extra_weight_yoyi]) || 0,
          commission_rate: parseNumericValue(row[commHeadersMap.commission_rate]),
          diff_rate_new_joiner: parseNumericValue(row[commHeadersMap.diff_rate_new_joiner]),
          count_pickup: parseInt(row[commHeadersMap.count_pickup]) || 0,
          extra_weight_commission: parseNumericValue(row[commHeadersMap.extra_weight_commission]),
          total_commission: parseNumericValue(row[commHeadersMap.total_commission]),
          addition_pickup_commission: parseNumericValue(row[commHeadersMap.addition_pickup_commission]),
          addition_fuel_allowance: parseNumericValue(row[commHeadersMap.addition_fuel_allowance]),
          addition_sorter: parseNumericValue(row[commHeadersMap.addition_sorter]),
          deduction_advance: parseNumericValue(row[commHeadersMap.deduction_advance]),
          deduction_pending_cod: parseNumericValue(row[commHeadersMap.deduction_pending_cod]),
          deduction_hq_penalty: parseNumericValue(row[commHeadersMap.deduction_hq_penalty]),
          deduction_duitnow_penalty: parseNumericValue(row[commHeadersMap.deduction_duitnow_penalty]),
          deduction_late_cod_penalty: parseNumericValue(row[commHeadersMap.deduction_late_cod_penalty]),
          deduction_lost_individual: parseNumericValue(row[commHeadersMap.deduction_lost_individual]),
          deduction_lost_parcel_hub: parseNumericValue(row[commHeadersMap.deduction_lost_parcel_hub]),
          nett_commission: parseNumericValue(row[commHeadersMap.nett_commission]),
          final_amount_to_pay: parseNumericValue(row[commHeadersMap.final_amount_to_pay]),
          system_reg: row[commHeadersMap.system_reg] ? row[commHeadersMap.system_reg].toString().trim() : '',
          parcel_qty_jms: parseInt(row[commHeadersMap.parcel_qty_jms]) || 0,
          status_payment: row[commHeadersMap.status_payment] ? row[commHeadersMap.status_payment].toString().trim() : 'SUCCESS',
          date_payment: row[commHeadersMap.date_payment] ? row[commHeadersMap.date_payment].toString().trim() : '',
          remark: row[commHeadersMap.remark] ? row[commHeadersMap.remark].toString().trim() : ''
        });

        recordsImported++;
      } catch (err) {
        errors++;
      }
    });

    // 4. PostgreSQL Transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (existingBatch && overwrite) {
        // Perform overwrite logic: delete old batch inside transaction
        await uploadRepository.deleteBatchWithClient(client, existingBatch.id);
        await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_OVERWRITE', filename, oldBatchId: existingBatch.id });
      }

      // Create new batch
      const batch = await uploadRepository.createBatch(client, {
        name: batchName,
        month,
        year,
        status: 'PUBLISHED', // Direct publish
        active: true,
        filename,
        type: 'COMMISSION',
        checksum,
        recordCount: recordsImported,
        uploadedBy: uploaderId
      });

      // Upsert mappings & insert commissions
      await uploadRepository.upsertDispatcherMappings(client, dispatcherMappings);
      await uploadRepository.bulkInsertCommissionRecords(client, batch.id, commissionRecords);

      await client.query('COMMIT');

      // Success Audit Log
      await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_SUCCESS', filename, batchId: batch.id });

      const duration = Date.now() - startTime;
      return {
        batchId: batch.id,
        summary: {
          recordsImported,
          recordsSkipped,
          duplicates,
          errors,
          duration
        }
      };
    } catch (err) {
      await client.query('ROLLBACK');
      await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: err.message, filename });
      throw new AppError(`Database transaction failure: ${err.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
    } finally {
      client.release();
    }
  }

  /**
   * Imports a Deduction Excel sheet
   */
  async importDeduction(fileBuffer, filename, uploaderId, reqBody, req) {
    const startTime = Date.now();
    const checksum = this.calculateChecksum(fileBuffer);

    const month = parseInt(reqBody.month);
    const year = parseInt(reqBody.year);
    const batchName = reqBody.name || `Deductions ${month}/${year}`;
    const overwrite = reqBody.overwrite === 'true' || reqBody.overwrite === true;

    if (!month || !year) {
      throw new AppError('Month and Year are required fields.', 400, 'UPLOAD_VALIDATION_ERROR');
    }

    // Start Audit Log
    await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_STARTED', filename, type: 'DEDUCTION' });

    // 1. Check duplicate
    const existingBatch = await uploadRepository.findBatchByChecksum(checksum);
    if (existingBatch) {
      if (!overwrite) {
        await auditLogService.logFailedLogin(reqBody.username || 'unknown', req, { action: 'UPLOAD_FAILED', reason: 'Duplicate file checksum', filename });
        throw new AppError('This file has already been uploaded.', 409, 'UPLOAD_DUPLICATE_FILE');
      }
      if (req.user.role !== 'ADMIN') {
        await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: 'Non-admin attempted overwrite', filename });
        throw new AppError('Only administrators are allowed to overwrite uploaded batches.', 403, 'UPLOAD_FORBIDDEN');
      }
    }

    // 2. Parse workbook securely
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const sheetNames = workbook.SheetNames;
    const dedSheetName = sheetNames.find(n => n.toLowerCase().includes('penalty') || n.toLowerCase().includes('deduction'));
    if (!dedSheetName) {
      throw new AppError('Lembaran "Details Penalty" tidak dijumpai dalam fail Excel.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const dedSheet = workbook.Sheets[dedSheetName];
    const dedRows = getSheetRows(dedSheet);
    if (dedRows.length === 0) {
      throw new AppError('Sheet "Details Penalty" is empty or contains no records.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    // Map headers dynamically
    const firstRow = dedRows[0];
    const dedHeadersMap = {};
    Object.keys(this.DEDUCTION_MAPPING_RULES).forEach(key => {
      dedHeadersMap[key] = null;
    });

    Object.keys(firstRow).forEach(header => {
      const cleanHeader = normalizeHeader(header);
      for (const [key, aliases] of Object.entries(this.DEDUCTION_MAPPING_RULES)) {
        if (!dedHeadersMap[key] && aliases.includes(cleanHeader)) {
          dedHeadersMap[key] = header;
          break;
        }
      }
    });

    // Validate required fields
    const requiredDedKeys = ['dispatcher_id', 'name'];
    const missingFields = requiredDedKeys.filter(key => !dedHeadersMap[key]);
    if (missingFields.length > 0) {
      throw new AppError(`Missing required template columns: ${missingFields.join(', ')}`, 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    // 3. Process rows and extract mappings
    const deductionRecords = [];
    const processedIds = new Set();

    let recordsImported = 0;
    let recordsSkipped = 0;
    let duplicates = 0;
    let errors = 0;

    // Retrieve active mappings from DB to resolve ic_numbers dynamically
    const mappingsRes = await db.query('SELECT dispatcher_id, ic_number FROM dispatcher_mappings');
    const dbMappings = {};
    mappingsRes.rows.forEach(m => {
      dbMappings[m.dispatcher_id] = m.ic_number;
    });

    dedRows.forEach(row => {
      try {
        const rawId = row[dedHeadersMap.dispatcher_id];
        const rawName = row[dedHeadersMap.name];

        if (!rawId || rawId.toString().trim() === '') {
          recordsSkipped++;
          return;
        }

        const dispatcher_id = rawId.toString().trim();
        const name = rawName ? rawName.toString().trim() : '';

        // Resolve IC from memory mappings list
        const ic_number = dbMappings[dispatcher_id] || '';
        if (!ic_number) {
          recordsSkipped++; // Skipped because dispatcher mapping is missing
          return;
        }

        if (processedIds.has(dispatcher_id)) {
          duplicates++;
          return;
        }
        processedIds.add(dispatcher_id);

        deductionRecords.push({
          dispatcher_id,
          ic_number,
          name,
          lost_pic_signed: parseNumericValue(row[dedHeadersMap.lost_pic_signed]),
          lost_rate: parseNumericValue(row[dedHeadersMap.lost_rate]),
          total_all_lost_shared: parseNumericValue(row[dedHeadersMap.total_all_lost_shared]),
          lost_parcel_pic_signed: parseNumericValue(row[dedHeadersMap.lost_parcel_pic_signed]),
          arbi_individual: parseNumericValue(row[dedHeadersMap.arbi_individual]),
          rcgen_penalty: parseNumericValue(row[dedHeadersMap.rcgen_penalty]),
          qc_penalty: parseNumericValue(row[dedHeadersMap.qc_penalty]),
          total_hq_penalty_detail: parseNumericValue(row[dedHeadersMap.total_hq_penalty_detail])
        });

        recordsImported++;
      } catch (err) {
        errors++;
      }
    });

    // 4. PostgreSQL Transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (existingBatch && overwrite) {
        await uploadRepository.deleteBatchWithClient(client, existingBatch.id);
        await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_OVERWRITE', filename, oldBatchId: existingBatch.id });
      }

      // Create new batch
      const batch = await uploadRepository.createBatch(client, {
        name: batchName,
        month,
        year,
        status: 'PUBLISHED',
        active: true,
        filename,
        type: 'DEDUCTION',
        checksum,
        recordCount: recordsImported,
        uploadedBy: uploaderId
      });

      // Insert deductions
      await uploadRepository.bulkInsertDeductionRecords(client, batch.id, deductionRecords);

      await client.query('COMMIT');

      // Success Audit Log
      await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_SUCCESS', filename, batchId: batch.id });

      const duration = Date.now() - startTime;
      return {
        batchId: batch.id,
        summary: {
          recordsImported,
          recordsSkipped,
          duplicates,
          errors,
          duration
        }
      };
    } catch (err) {
      await client.query('ROLLBACK');
      await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: err.message, filename });
      throw new AppError(`Database transaction failure: ${err.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves full upload history list
   */
  async getUploadHistory() {
    return uploadRepository.getUploadHistory();
  }

  /**
   * Retrieves batch details and record arrays
   */
  async getBatchDetails(batchId) {
    const batch = await uploadRepository.findBatchById(batchId);
    if (!batch) {
      throw new AppError('Batch record not found.', 404, 'UPLOAD_BATCH_NOT_FOUND');
    }

    let records = [];
    if (batch.type === 'COMMISSION') {
      records = await uploadRepository.getCommissionRecordsByBatch(batchId);
    } else {
      records = await uploadRepository.getDeductionRecordsByBatch(batchId);
    }

    return {
      batch,
      records
    };
  }
}

module.exports = new UploadService();
