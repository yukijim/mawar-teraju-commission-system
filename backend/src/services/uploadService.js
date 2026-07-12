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
  return XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '', raw: false });
};

class UploadService {
  constructor() {
    // In-memory trackers for enterprise batch management
    this.uploadProgress = new Map(); // batchId -> { status, progress, totalRecords, processedRecords }
    this.activeLocks = new Set();    // Set of active checksums to prevent concurrent duplicate uploads
  }

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
   * Checks if a batch is locked by current VALIDATING or IMPORTING processes
   */
  isBatchLocked(batchId) {
    const progress = this.uploadProgress.get(batchId);
    return progress && (progress.status === 'VALIDATING' || progress.status === 'IMPORTING');
  }

  /**
   * Imports a Commission Excel sheet in DRAFT status
   */
  async importCommission(fileBuffer, filename, uploaderId, reqBody, req) {
    const startTime = Date.now();
    const checksum = this.calculateChecksum(fileBuffer);
    const tempBatchId = crypto.randomUUID(); // Pre-generate UUID for tracking progress

    const month = parseInt(reqBody.month, 10);
    const year = parseInt(reqBody.year, 10);
    const batchName = reqBody.name || `Commission ${month}/${year}`;
    const overwrite = reqBody.overwrite === 'true' || reqBody.overwrite === true;

    if (!month || !year) {
      throw new AppError('Month and Year are required fields.', 400, 'UPLOAD_VALIDATION_ERROR');
    }

    // Check Lock: Prevent concurrent duplicate uploads
    if (this.activeLocks.has(checksum)) {
      throw new AppError('This file is currently being processed. Please wait.', 409, 'UPLOAD_BATCH_LOCKED');
    }
    this.activeLocks.add(checksum);

    // Initial Progress Setup
    this.uploadProgress.set(tempBatchId, {
      status: 'VALIDATING',
      progress: 10,
      totalRecords: 0,
      processedRecords: 0
    });

    await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_STARTED', filename, type: 'COMMISSION', tempBatchId });

    try {
      // 1. Check duplicate file
      const existingBatch = await uploadRepository.findBatchByChecksum(checksum);
      if (existingBatch) {
        if (!overwrite) {
          throw new AppError('This file has already been uploaded.', 409, 'UPLOAD_DUPLICATE_FILE');
        }
        if (req.user.role !== 'ADMIN') {
          throw new AppError('Only administrators are allowed to overwrite uploaded batches.', 403, 'UPLOAD_FORBIDDEN');
        }
        // Prevent overwrite during import
        if (this.isBatchLocked(existingBatch.id)) {
          throw new AppError('The duplicate batch is currently undergoing an active import process. Overwrite rejected.', 409, 'UPLOAD_BATCH_LOCKED');
        }
      }

      this.uploadProgress.set(tempBatchId, { status: 'VALIDATING', progress: 20, totalRecords: 0, processedRecords: 0 });

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

      // 3. Process rows and check duplicates (Batch ID, Dispatcher ID, IC Number)
      const dispatcherMappings = [];
      const commissionRecords = [];
      const processedKeys = new Set(); // To detect duplicate combination: tempBatchId + Dispatcher ID + IC Number

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

          // Detect duplicate records: Batch ID + Dispatcher ID + IC Number
          const recordKey = `${tempBatchId}_${dispatcher_id}_${ic_number}`;
          if (processedKeys.has(recordKey)) {
            duplicates++;
            return;
          }
          processedKeys.add(recordKey);

          dispatcherMappings.push({ dispatcher_id, ic_number, name });

          commissionRecords.push({
            dispatcher_id,
            ic_number,
            name,
            parcel_qty: parseInt(row[commHeadersMap.parcel_qty], 10) || 0,
            net_parcel: parseInt(row[commHeadersMap.net_parcel], 10) || 0,
            exclude_extra_weight_yoyi: parseInt(row[commHeadersMap.exclude_extra_weight_yoyi], 10) || 0,
            commission_rate: parseNumericValue(row[commHeadersMap.commission_rate]),
            diff_rate_new_joiner: parseNumericValue(row[commHeadersMap.diff_rate_new_joiner]),
            count_pickup: parseInt(row[commHeadersMap.count_pickup], 10) || 0,
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
            parcel_qty_jms: parseInt(row[commHeadersMap.parcel_qty_jms], 10) || 0,
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
      this.uploadProgress.set(tempBatchId, { status: 'IMPORTING', progress: 30, totalRecords: commissionRecords.length, processedRecords: 0 });

      // Determine version & previous batch link
      const latestVer = await uploadRepository.getMaxVersionForPeriod(month, year);
      const version = latestVer + 1;
      const previousBatchId = await uploadRepository.findLatestActiveBatch(month, year);

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (existingBatch && overwrite) {
          await uploadRepository.deleteBatchWithClient(client, existingBatch.id);
          await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_OVERWRITE', filename, oldBatchId: existingBatch.id });
        }

        // Create new batch record inside transaction block (in DRAFT status)
        const batch = await uploadRepository.createBatch(client, {
          id: tempBatchId,
          name: batchName,
          month,
          year,
          status: 'DRAFT', // Upload initializes as DRAFT
          active: false,
          filename,
          type: 'COMMISSION',
          checksum,
          recordCount: recordsImported,
          uploadedBy: uploaderId,
          version,
          previousBatchId
        });

        // Upsert mappings
        await uploadRepository.upsertDispatcherMappings(client, dispatcherMappings);

        // Bulk insert commission records in chunks of 500 to update progress
        const chunkSize = 500;
        for (let i = 0; i < commissionRecords.length; i += chunkSize) {
          const chunk = commissionRecords.slice(i, i + chunkSize);
          await uploadRepository.bulkInsertCommissionRecords(client, batch.id, chunk);

          const processed = Math.min(i + chunkSize, commissionRecords.length);
          const percent = 30 + Math.round((processed / commissionRecords.length) * 60); // from 30% to 90%
          this.uploadProgress.set(tempBatchId, {
            status: 'IMPORTING',
            progress: percent,
            totalRecords: commissionRecords.length,
            processedRecords: processed
          });
        }

        await client.query('COMMIT');

        // Status turns to IMPORTED on commit success
        await db.query("UPDATE batches SET status = 'IMPORTED' WHERE id = $1", [batch.id]);

        this.uploadProgress.set(tempBatchId, {
          status: 'IMPORTED',
          progress: 100,
          totalRecords: commissionRecords.length,
          processedRecords: commissionRecords.length
        });

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
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      this.uploadProgress.set(tempBatchId, { status: 'FAILED', progress: 0, totalRecords: 0, processedRecords: 0 });
      await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: err.message, filename });
      throw err;
    } finally {
      this.activeLocks.delete(checksum);
    }
  }

  /**
   * Imports a Deduction Excel sheet in DRAFT status
   */
  async importDeduction(fileBuffer, filename, uploaderId, reqBody, req) {
    const startTime = Date.now();
    const checksum = this.calculateChecksum(fileBuffer);
    const tempBatchId = crypto.randomUUID();

    const month = parseInt(reqBody.month, 10);
    const year = parseInt(reqBody.year, 10);
    const batchName = reqBody.name || `Deductions ${month}/${year}`;
    const overwrite = reqBody.overwrite === 'true' || reqBody.overwrite === true;

    if (!month || !year) {
      throw new AppError('Month and Year are required fields.', 400, 'UPLOAD_VALIDATION_ERROR');
    }

    if (this.activeLocks.has(checksum)) {
      throw new AppError('This file is currently being processed. Please wait.', 409, 'UPLOAD_BATCH_LOCKED');
    }
    this.activeLocks.add(checksum);

    this.uploadProgress.set(tempBatchId, {
      status: 'VALIDATING',
      progress: 10,
      totalRecords: 0,
      processedRecords: 0
    });

    await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_STARTED', filename, type: 'DEDUCTION', tempBatchId });

    try {
      // 1. Check duplicate
      const existingBatch = await uploadRepository.findBatchByChecksum(checksum);
      if (existingBatch) {
        if (!overwrite) {
          throw new AppError('This file has already been uploaded.', 409, 'UPLOAD_DUPLICATE_FILE');
        }
        if (req.user.role !== 'ADMIN') {
          throw new AppError('Only administrators are allowed to overwrite uploaded batches.', 403, 'UPLOAD_FORBIDDEN');
        }
        if (this.isBatchLocked(existingBatch.id)) {
          throw new AppError('The duplicate batch is currently undergoing an active import process. Overwrite rejected.', 409, 'UPLOAD_BATCH_LOCKED');
        }
      }

      this.uploadProgress.set(tempBatchId, { status: 'VALIDATING', progress: 20, totalRecords: 0, processedRecords: 0 });

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

      // 3. Process rows and check duplicates (Batch ID + Dispatcher ID + IC)
      const deductionRecords = [];
      const processedKeys = new Set();

      let recordsImported = 0;
      let recordsSkipped = 0;
      let duplicates = 0;
      let errors = 0;

      // Retrieve mapping table from DB to resolve IC values
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

          const ic_number = dbMappings[dispatcher_id] || '';
          if (!ic_number) {
            recordsSkipped++;
            return;
          }

          // Detect duplicate records: Batch ID + Dispatcher ID + IC Number
          const recordKey = `${tempBatchId}_${dispatcher_id}_${ic_number}`;
          if (processedKeys.has(recordKey)) {
            duplicates++;
            return;
          }
          processedKeys.add(recordKey);

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
      this.uploadProgress.set(tempBatchId, { status: 'IMPORTING', progress: 30, totalRecords: deductionRecords.length, processedRecords: 0 });

      const latestVer = await uploadRepository.getMaxVersionForPeriod(month, year);
      const version = latestVer + 1;
      const previousBatchId = await uploadRepository.findLatestActiveBatch(month, year);

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (existingBatch && overwrite) {
          await uploadRepository.deleteBatchWithClient(client, existingBatch.id);
          await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_OVERWRITE', filename, oldBatchId: existingBatch.id });
        }

        // Create new batch record inside transaction block (in DRAFT status)
        const batch = await uploadRepository.createBatch(client, {
          id: tempBatchId,
          name: batchName,
          month,
          year,
          status: 'DRAFT',
          active: false,
          filename,
          type: 'DEDUCTION',
          checksum,
          recordCount: recordsImported,
          uploadedBy: uploaderId,
          version,
          previousBatchId
        });

        // Bulk insert deduction records in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < deductionRecords.length; i += chunkSize) {
          const chunk = deductionRecords.slice(i, i + chunkSize);
          await uploadRepository.bulkInsertDeductionRecords(client, batch.id, chunk);

          const processed = Math.min(i + chunkSize, deductionRecords.length);
          const percent = 30 + Math.round((processed / deductionRecords.length) * 60); // from 30% to 90%
          this.uploadProgress.set(tempBatchId, {
            status: 'IMPORTING',
            progress: percent,
            totalRecords: deductionRecords.length,
            processedRecords: processed
          });
        }

        await client.query('COMMIT');

        // Status turns to IMPORTED on commit success
        await db.query("UPDATE batches SET status = 'IMPORTED' WHERE id = $1", [batch.id]);

        this.uploadProgress.set(tempBatchId, {
          status: 'IMPORTED',
          progress: 100,
          totalRecords: deductionRecords.length,
          processedRecords: deductionRecords.length
        });

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
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      this.uploadProgress.set(tempBatchId, { status: 'FAILED', progress: 0, totalRecords: 0, processedRecords: 0 });
      await auditLogService.logFailedLogin(req.user.username, req, { action: 'UPLOAD_FAILED', reason: err.message, filename });
      throw err;
    } finally {
      this.activeLocks.delete(checksum);
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

  /**
   * GET /api/v1/upload/progress/:batchId
   * Returns current active progress for the batch, falling back to database status.
   */
  async getProgress(batchId) {
    const active = this.uploadProgress.get(batchId);
    if (active) {
      return {
        batchId,
        status: active.status,
        progress: active.progress,
        totalRecords: active.totalRecords,
        processedRecords: active.processedRecords
      };
    }

    const batch = await uploadRepository.findBatchById(batchId);
    if (!batch) {
      throw new AppError('Batch record not found.', 404, 'UPLOAD_BATCH_NOT_FOUND');
    }

    return {
      batchId,
      status: batch.status,
      progress: 100,
      totalRecords: batch.record_count,
      processedRecords: batch.record_count
    };
  }

  /**
   * Publishes an IMPORTED batch, deactivating concurrent batches for the same month/year
   */
  async publishBatch(batchId, userId, req) {
    // Prevent publish during import
    if (this.isBatchLocked(batchId)) {
      throw new AppError('This batch is currently undergoing import. Publish locked.', 409, 'UPLOAD_BATCH_LOCKED');
    }

    const batch = await uploadRepository.findBatchById(batchId);
    if (!batch) {
      throw new AppError('Batch record not found.', 404, 'UPLOAD_BATCH_NOT_FOUND');
    }

    if (batch.status === 'PUBLISHED') {
      throw new AppError('This batch has already been published.', 400, 'UPLOAD_BATCH_ALREADY_PUBLISHED');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Deactivate all other published batches for the same month/year
      await uploadRepository.deactivateOtherBatches(client, batchId, batch.month, batch.year);

      // Publish the current batch
      const updatedBatch = await uploadRepository.publishBatch(client, batchId, userId, batch.previous_batch_id);

      await client.query('COMMIT');

      await auditLogService.logSuccessLogin(userId, req, { action: 'PUBLISH_BATCH', batchId, name: batch.name });

      return updatedBatch;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new AppError(`Publish database failure: ${err.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
    } finally {
      client.release();
    }
  }

  /**
   * Rolls back an active published batch to its previous_batch_id
   */
  async rollbackBatch(batchId, userId, req) {
    if (this.isBatchLocked(batchId)) {
      throw new AppError('This batch is locked due to active import. Rollback rejected.', 409, 'UPLOAD_BATCH_LOCKED');
    }

    const batch = await uploadRepository.findBatchById(batchId);
    if (!batch) {
      throw new AppError('Batch record not found.', 404, 'UPLOAD_BATCH_NOT_FOUND');
    }

    if (!batch.previous_batch_id) {
      throw new AppError('This batch has no previous version records. Rollback aborted.', 400, 'UPLOAD_ROLLBACK_IMPOSSIBLE');
    }

    // Verify previous batch exists and is not soft deleted
    const prevBatch = await uploadRepository.findBatchById(batch.previous_batch_id);
    if (!prevBatch) {
      throw new AppError('Previous batch record was deleted or is missing.', 404, 'UPLOAD_PREVIOUS_BATCH_NOT_FOUND');
    }

    // Prevent rollback to a locked previous batch
    if (this.isBatchLocked(batch.previous_batch_id)) {
      throw new AppError('Previous batch is currently locked by import.', 409, 'UPLOAD_BATCH_LOCKED');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Execute rollback operations
      await uploadRepository.executeRollback(client, batchId, batch.previous_batch_id, userId);

      await client.query('COMMIT');

      await auditLogService.logSuccessLogin(userId, req, { action: 'ROLLBACK_BATCH', batchId, rolledBackTo: batch.previous_batch_id });

      return {
        message: 'Batch successfully rolled back to previous version.',
        deactivatedBatchId: batchId,
        reactivatedBatchId: batch.previous_batch_id
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw new AppError(`Rollback database failure: ${err.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
    } finally {
      client.release();
    }
  }
}

module.exports = new UploadService();
