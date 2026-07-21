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
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\xa0\u2007\u202F\u205F\u3000]/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

/**
 * Helper to parse clean numeric value from Excel cells
 */
const parseNumericValue = (val) => {
  if (val === undefined || val === null) return 0.00;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.00 : parsed;
};

/**
 * Helper to parse clean integer value from Excel cells
 */
const parseIntegerValue = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.round(val);
  const cleaned = val.toString().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
};

/**
 * Helper to convert sheet to array of rows, ignoring empty rows
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
    ic_number: ['delivery dispatcher ic no', 'delivery dispatcher ic no.'],
    dispatcher_id: ['delivery dispatcher id'],
    name: ['delivery dispatcher name'],
    parcel_qty: ['parcel quantity'],
    parcel_commission: ['parcel commission'],
    extra_weight_commission: ['extra weight commission'],
    total_commission: ['total commission'],
    refund_penalty: ['add refund penalty', 'add: refund penalty'],
    pickup_commission: ['add pickup commission', 'add: pickup commission'],
    others: ['add others', 'add: others'],
    sorter: ['add sorter', 'add: sorter'],
    extra_reward: ['extra reward', 'add extra reward', 'add: extra reward'],
    nett_commission: ['nett commission']
  };

  DEDUCTION_MAPPING_RULES = {
    ic_number: ['delivery dispatcher ic no', 'delivery dispatcher ic no.'],
    dispatcher_id: ['delivery dispatcher id'],
    name: ['delivery dispatcher name'],
    others: ['deduction others', 'deduction: others', 'deduction advance', 'deduction: advance'],
    pending_cod: ['deduction pending cod', 'deduction: pending cod'],
    hq_penalty: ['deduction hq penalty', 'deduction: hq penalty'],
    duitnow_penalty: ['deduction duitnow penalty', 'deduction: duitnow penalty'],
    late_cod_penalty: ['deduction late cod penalty', 'deduction: late cod penalty'],
    lost_individual: ['deduction lost individual', 'deduction: lost individual'],
    lost_parcel_hub: ['deduction lost parcel hub', 'deduction: lost parcel hub']
  };

  validateExcelFormat(workbook, type) {
    const sheetNames = workbook.SheetNames;
    let targetSheetName = null;
    let requiredKeys = [];
    let mappingRules = {};

    if (type === 'COMMISSION') {
      targetSheetName = sheetNames.find(n => {
        if (!n) return false;
        const normalized = n.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
        return normalized === 'commission' || normalized === 'komisen';
      });
      if (!targetSheetName) {
        console.error('Validation failed: Commission sheet not found. Actual sheet names in workbook:', sheetNames);
        throw new AppError(`Fail Excel tidak sah: Lembaran "Commission" atau "Komisen" tidak ditemui. Senarai sheet sebenar: [${sheetNames.join(', ')}]`, 400, 'UPLOAD_INVALID_TEMPLATE');
      }
      requiredKeys = [
        'ic_number', 'dispatcher_id', 'name', 'parcel_qty', 'parcel_commission', 
        'extra_weight_commission', 'total_commission', 'refund_penalty', 
        'pickup_commission', 'others', 'sorter', 'extra_reward', 'nett_commission'
      ];
      mappingRules = this.COMMISSION_MAPPING_RULES;
    } else if (type === 'DEDUCTION') {
      targetSheetName = sheetNames.find(n => {
        if (!n) return false;
        const normalized = n.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
        return normalized === 'deduction' || normalized === 'potongan';
      });
      if (!targetSheetName) {
        console.error('Validation failed: Deduction sheet not found. Actual sheet names in workbook:', sheetNames);
        throw new AppError(`Fail Excel tidak sah: Lembaran "Deduction" atau "Potongan" tidak ditemui. Senarai sheet sebenar: [${sheetNames.join(', ')}]`, 400, 'UPLOAD_INVALID_TEMPLATE');
      }
      requiredKeys = [
        'ic_number', 'dispatcher_id', 'name', 'others', 'pending_cod', 
        'hq_penalty', 'duitnow_penalty', 'late_cod_penalty', 
        'lost_individual', 'lost_parcel_hub'
      ];
      mappingRules = this.DEDUCTION_MAPPING_RULES;
    }

    const sheet = workbook.Sheets[targetSheetName];
    const rows = getSheetRows(sheet);
    if (rows.length === 0) {
      throw new AppError('Fail Excel tidak sah: Lembaran kosong atau tidak mempunyai rekod.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const firstRow = rows[0];
    const originalHeaders = Object.keys(firstRow);
    const matchedKeys = new Set();
    const warnings = [];

    originalHeaders.forEach(header => {
      const cleanHeader = normalizeHeader(header);
      let recognized = false;
      for (const [key, aliases] of Object.entries(mappingRules)) {
        const normAliases = aliases.map(a => normalizeHeader(a));
        if (normAliases.includes(cleanHeader) || (key === 'others' && cleanHeader.includes('OTHERS'))) {
          matchedKeys.add(key);
          recognized = true;
          break;
        }
      }
      if (!recognized && cleanHeader !== '') {
        warnings.push(`Amaran: Kolum tidak dikenali "${header}" dijumpai dan akan diabaikan.`);
      }
    });

    const missingKeys = requiredKeys.filter(key => !matchedKeys.has(key));
    if (missingKeys.length > 0) {
      console.error('=== UPLOAD VALIDATION FAILED ===');
      console.error(`Sheet type: ${type}`);
      console.error(`Missing columns: ${missingKeys.join(', ')}`);
      
      console.error('\nExpected Columns (with aliases) | Actual Columns Found');
      console.error('--------------------------------|----------------------');
      const maxLen = Math.max(requiredKeys.length, originalHeaders.length);
      for (let i = 0; i < maxLen; i++) {
        const expected = requiredKeys[i] ? `${requiredKeys[i]} (${(mappingRules[requiredKeys[i]] || []).join(' / ')})` : '';
        const actual = originalHeaders[i] ? `${originalHeaders[i]} (normalized: "${normalizeHeader(originalHeaders[i])}")` : '';
        console.error(`${expected.padEnd(31)} | ${actual}`);
      }
      console.error('================================');

      throw new AppError(`Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: ${missingKeys.join(', ')} dalam sheet ${targetSheetName}. Sila semak log pelayan untuk perbandingan penuh.`, 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    return {
      isValid: true,
      sheetName: targetSheetName,
      warnings
    };
  }

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
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const validation = this.validateExcelFormat(workbook, 'COMMISSION');
    const commSheetName = validation.sheetName;
    const commSheet = workbook.Sheets[commSheetName];
    const commRows = getSheetRows(commSheet);

    const startTime = Date.now();
    const checksum = this.calculateChecksum(fileBuffer);
    const tempBatchId = crypto.randomUUID();

    const month = parseInt(reqBody.month, 10);
    const year = parseInt(reqBody.year, 10);
    const batchName = reqBody.name || `Commission ${month}/${year}`;
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

    await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_STARTED', filename, type: 'COMMISSION', tempBatchId });

    try {
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

      const firstRow = commRows[0];
      const commHeadersMap = {};
      Object.keys(this.COMMISSION_MAPPING_RULES).forEach(key => {
        commHeadersMap[key] = null;
      });

      Object.keys(firstRow).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(this.COMMISSION_MAPPING_RULES)) {
          const normAliases = aliases.map(a => normalizeHeader(a));
          if (normAliases.includes(cleanHeader) || (key === 'others' && cleanHeader.includes('OTHERS'))) {
            commHeadersMap[key] = header;
            break;
          }
        }
      });

      // Retrieve mapping table from DB to resolve IC values
      const mappingsRes = await db.query('SELECT dispatcher_id, ic_number FROM dispatcher_mappings');
      const dbMappings = {};
      mappingsRes.rows.forEach(m => {
        dbMappings[m.dispatcher_id] = m.ic_number;
      });

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
          let ic_number = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
          if (!ic_number || ic_number.length < 7) {
            ic_number = dbMappings[dispatcher_id] || '';
          }
          const name = rawName ? rawName.toString().trim() : '';

          if (!ic_number || ic_number.length < 7) {
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
            parcel_qty: parseIntegerValue(row[commHeadersMap.parcel_qty]),
            net_parcel: 0,
            exclude_extra_weight_yoyi: 0,
            commission_rate: parseNumericValue(row[commHeadersMap.parcel_commission]),
            diff_rate_new_joiner: 0,
            count_pickup: 0,
            extra_weight_commission: parseNumericValue(row[commHeadersMap.extra_weight_commission]),
            total_commission: parseNumericValue(row[commHeadersMap.total_commission]),
            addition_pickup_commission: parseNumericValue(row[commHeadersMap.pickup_commission]),
            addition_refund_penalty: parseNumericValue(row[commHeadersMap.refund_penalty]),
            addition_sorter: parseNumericValue(row[commHeadersMap.sorter]),
            deduction_others: 0,
            deduction_pending_cod: 0,
            deduction_hq_penalty: 0,
            deduction_duitnow_penalty: 0,
            deduction_late_cod_penalty: 0,
            deduction_lost_individual: 0,
            deduction_lost_parcel_hub: 0,
            nett_commission: parseNumericValue(row[commHeadersMap.nett_commission]),
            final_amount_to_pay: parseNumericValue(row[commHeadersMap.nett_commission]),
            addition_others: parseNumericValue(row[commHeadersMap.others]),
            addition_extra_reward: parseNumericValue(row[commHeadersMap.extra_reward]),
            parcel_qty_jms: 0,
            status_payment: 'SUCCESS',
            date_payment: '',
            remark: ''
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
      const previousBatchId = await uploadRepository.findLatestActiveBatch(month, year, 'COMMISSION');

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
          warnings: validation.warnings,
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
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const validation = this.validateExcelFormat(workbook, 'DEDUCTION');
    const dedSheetName = validation.sheetName;
    const dedSheet = workbook.Sheets[dedSheetName];
    const dedRows = getSheetRows(dedSheet);

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

      const firstRow = dedRows[0];
      const dedHeadersMap = {};
      Object.keys(this.DEDUCTION_MAPPING_RULES).forEach(key => {
        dedHeadersMap[key] = null;
      });

      Object.keys(firstRow).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(this.DEDUCTION_MAPPING_RULES)) {
          const normAliases = aliases.map(a => normalizeHeader(a));
          if (normAliases.includes(cleanHeader) || (key === 'others' && cleanHeader.includes('OTHERS'))) {
            dedHeadersMap[key] = header;
            break;
          }
        }
      });

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
          const rawIc = row[dedHeadersMap.ic_number];
          const rawName = row[dedHeadersMap.name];

          if (!rawId || rawId.toString().trim() === '') {
            recordsSkipped++;
            return;
          }

          const dispatcher_id = rawId.toString().trim();
          const name = rawName ? rawName.toString().trim() : '';

          const rawIcString = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
          let ic_number = rawIcString;
          if (!ic_number || ic_number.length < 7) {
            ic_number = dbMappings[dispatcher_id] || '';
          }
          if (!ic_number) {
            // Check if dispatcher_id itself is a valid 12-digit IC (dashes/spaces stripped)
            const cleanId = dispatcher_id.replace(/[\s-]/g, '');
            if (/^\d{12}$/.test(cleanId)) {
              ic_number = cleanId;
            } else {
              recordsSkipped++;
              return;
            }
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
            deduction_others: parseNumericValue(row[dedHeadersMap.others]),
            deduction_pending_cod: parseNumericValue(row[dedHeadersMap.pending_cod]),
            deduction_hq_penalty: parseNumericValue(row[dedHeadersMap.hq_penalty]),
            deduction_duitnow_penalty: parseNumericValue(row[dedHeadersMap.duitnow_penalty]),
            deduction_late_cod_penalty: parseNumericValue(row[dedHeadersMap.late_cod_penalty]),
            deduction_lost_individual: parseNumericValue(row[dedHeadersMap.lost_individual]),
            deduction_lost_parcel_hub: parseNumericValue(row[dedHeadersMap.lost_parcel_hub]),
            lost_pic_signed: 0,
            lost_rate: 0,
            total_all_lost_shared: 0,
            lost_parcel_pic_signed: 0,
            arbi_individual: 0,
            rcgen_penalty: 0,
            qc_penalty: 0,
            total_hq_penalty_detail: 0
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
      const previousBatchId = await uploadRepository.findLatestActiveBatch(month, year, 'DEDUCTION');

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
          warnings: validation.warnings,
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

      // Deactivate all other published batches for the same month/year and type
      await uploadRepository.deactivateOtherBatches(client, batchId, batch.month, batch.year, batch.type);

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

  /**
   * Hard-deletes a batch and all of its associated records
   */
  async deleteBatch(batchId, userId, req) {
    if (this.isBatchLocked(batchId)) {
      throw new AppError('This batch is locked due to active import. Delete rejected.', 409, 'UPLOAD_BATCH_LOCKED');
    }

    const batch = await uploadRepository.findBatchById(batchId);
    if (!batch) {
      throw new AppError('Batch record not found.', 404, 'UPLOAD_BATCH_NOT_FOUND');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1. Delete commission records
      await client.query('DELETE FROM commission_records WHERE batch_id = $1', [batchId]);

      // 2. Delete deduction records
      await client.query('DELETE FROM deduction_records WHERE batch_id = $1', [batchId]);

      // 3. Delete the batch itself
      await client.query('DELETE FROM batches WHERE id = $1', [batchId]);

      await client.query('COMMIT');

      await auditLogService.logSuccessLogin(userId, req, { action: 'DELETE_BATCH', batchId, name: batch.name });

      return {
        message: 'Batch deleted successfully from database.',
        deletedBatchId: batchId
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw new AppError(`Delete batch failure: ${err.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
    } finally {
      client.release();
    }
  }

  async importBatch(fileBuffer, filename, uploaderId, reqBody, req) {
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const validationComm = this.validateExcelFormat(workbook, 'COMMISSION');
    const validationDed = this.validateExcelFormat(workbook, 'DEDUCTION');

    const commSheetName = validationComm.sheetName;
    const commSheet = workbook.Sheets[commSheetName];
    const commRows = getSheetRows(commSheet);

    const dedSheetName = validationDed.sheetName;
    const dedSheet = workbook.Sheets[dedSheetName];
    const dedRows = getSheetRows(dedSheet);

    const checksum = this.calculateChecksum(fileBuffer);
    const commBatchId = crypto.randomUUID();
    const dedBatchId = crypto.randomUUID();

    const month = parseInt(reqBody.month, 10);
    const year = parseInt(reqBody.year, 10);
    const batchName = reqBody.name || `Batch ${month}/${year}`;
    const overwrite = reqBody.overwrite === 'true' || reqBody.overwrite === true;

    if (!month || !year) {
      throw new AppError('Month and Year are required fields.', 400, 'UPLOAD_VALIDATION_ERROR');
    }

    const commChecksum = checksum.slice(0, 59) + '_COMM';
    const dedChecksum = checksum.slice(0, 60) + '_DED';

    if (this.activeLocks.has(commChecksum)) {
      throw new AppError('This file is currently being processed. Please wait.', 409, 'UPLOAD_BATCH_LOCKED');
    }
    this.activeLocks.add(commChecksum);

    try {
      const existingCommBatch = await uploadRepository.findBatchByChecksum(commChecksum);
      const existingDedBatch = await uploadRepository.findBatchByChecksum(dedChecksum);

      if ((existingCommBatch || existingDedBatch) && !overwrite) {
        throw new AppError('This file has already been uploaded.', 409, 'UPLOAD_DUPLICATE_FILE');
      }

      this.uploadProgress.set(commBatchId, { status: 'VALIDATING', progress: 20, totalRecords: 0, processedRecords: 0 });

      // 1. Process Commission headers and rows
      const commHeadersMap = {};
      Object.keys(this.COMMISSION_MAPPING_RULES).forEach(key => {
        commHeadersMap[key] = null;
      });
      Object.keys(commRows[0]).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(this.COMMISSION_MAPPING_RULES)) {
          const normAliases = aliases.map(a => normalizeHeader(a));
          if (normAliases.includes(cleanHeader) || (key === 'others' && cleanHeader.includes('OTHERS'))) {
            commHeadersMap[key] = header;
            break;
          }
        }
      });

      // Retrieve mapping table from DB to resolve IC values
      const mappingsRes = await db.query('SELECT dispatcher_id, ic_number FROM dispatcher_mappings');
      const dbMappings = {};
      mappingsRes.rows.forEach(m => {
        dbMappings[m.dispatcher_id] = m.ic_number;
      });

      const dispatcherMappings = [];
      const commissionRecords = [];
      const commProcessedKeys = new Set();
      const resolvedDispatcherIcs = {};
      const resolvedDispatcherNames = {};
      const icToNames = {};

      commRows.forEach(row => {
        const rawId = row[commHeadersMap.dispatcher_id];
        const rawIc = row[commHeadersMap.ic_number];
        const rawName = row[commHeadersMap.name];

        if (!rawId || rawId.toString().trim() === '') return;

        const dispatcher_id = rawId.toString().trim();
        let ic_number = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
        if (!ic_number || ic_number.length < 7) {
          ic_number = dbMappings[dispatcher_id] || '';
        }
        const name = rawName ? rawName.toString().trim() : '';

        if (!ic_number || ic_number.length < 7) return;

        resolvedDispatcherIcs[dispatcher_id] = ic_number;
        resolvedDispatcherNames[dispatcher_id] = name;

        if (ic_number && name) {
          const normName = name.replace(/\s+/g, ' ').trim().toUpperCase();
          if (!icToNames[ic_number]) {
            icToNames[ic_number] = new Set();
          }
          icToNames[ic_number].add(normName);
        }

        const recordKey = `${commBatchId}_${dispatcher_id}_${ic_number}`;
        if (commProcessedKeys.has(recordKey)) return;
        commProcessedKeys.add(recordKey);

        dispatcherMappings.push({ dispatcher_id, ic_number, name });
        commissionRecords.push({
          dispatcher_id,
          ic_number,
          name,
          parcel_qty: parseIntegerValue(row[commHeadersMap.parcel_qty]),
          net_parcel: 0,
          exclude_extra_weight_yoyi: 0,
          commission_rate: parseNumericValue(row[commHeadersMap.parcel_commission]),
          diff_rate_new_joiner: 0,
          count_pickup: 0,
          extra_weight_commission: parseNumericValue(row[commHeadersMap.extra_weight_commission]),
          total_commission: parseNumericValue(row[commHeadersMap.total_commission]),
          addition_pickup_commission: parseNumericValue(row[commHeadersMap.pickup_commission]),
          addition_refund_penalty: parseNumericValue(row[commHeadersMap.refund_penalty]),
          addition_sorter: parseNumericValue(row[commHeadersMap.sorter]),
          deduction_others: 0,
          deduction_pending_cod: 0,
          deduction_hq_penalty: 0,
          deduction_duitnow_penalty: 0,
          deduction_late_cod_penalty: 0,
          deduction_lost_individual: 0,
          deduction_lost_parcel_hub: 0,
          nett_commission: parseNumericValue(row[commHeadersMap.nett_commission]),
          final_amount_to_pay: parseNumericValue(row[commHeadersMap.nett_commission]),
          addition_others: parseNumericValue(row[commHeadersMap.others]),
          addition_extra_reward: parseNumericValue(row[commHeadersMap.extra_reward]),
          parcel_qty_jms: 0,
          status_payment: 'SUCCESS',
          date_payment: '',
          remark: ''
        });
      });

      // 2. Process Deduction headers and rows
      const dedHeadersMap = {};
      Object.keys(this.DEDUCTION_MAPPING_RULES).forEach(key => {
        dedHeadersMap[key] = null;
      });
      Object.keys(dedRows[0]).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(this.DEDUCTION_MAPPING_RULES)) {
          const normAliases = aliases.map(a => normalizeHeader(a));
          if (normAliases.includes(cleanHeader) || (key === 'others' && cleanHeader.includes('OTHERS'))) {
            dedHeadersMap[key] = header;
            break;
          }
        }
      });



      const deductionRecords = [];
      const dedProcessedKeys = new Set();

      dedRows.forEach(row => {
        const rawId = row[dedHeadersMap.dispatcher_id];
        const rawIc = row[dedHeadersMap.ic_number];
        const rawName = row[dedHeadersMap.name];

        if (!rawId || rawId.toString().trim() === '') return;

        const dispatcher_id = rawId.toString().trim();
        
        let ic_number = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
        if (!ic_number || ic_number.length < 7) {
          ic_number = resolvedDispatcherIcs[dispatcher_id] || dbMappings[dispatcher_id] || '';
        }
        if (!ic_number) {
          const cleanId = dispatcher_id.replace(/[\s-]/g, '');
          if (/^\d{12}$/.test(cleanId)) {
            ic_number = cleanId;
          } else {
            return;
          }
        }

        const name = (rawName ? rawName.toString().trim() : '') || resolvedDispatcherNames[dispatcher_id] || '';

        if (ic_number && name) {
          const normName = name.replace(/\s+/g, ' ').trim().toUpperCase();
          if (!icToNames[ic_number]) {
            icToNames[ic_number] = new Set();
          }
          icToNames[ic_number].add(normName);
        }

        const recordKey = `${dedBatchId}_${dispatcher_id}_${ic_number}`;
        if (dedProcessedKeys.has(recordKey)) return;
        dedProcessedKeys.add(recordKey);

        deductionRecords.push({
          dispatcher_id,
          ic_number,
          name,
          deduction_others: parseNumericValue(row[dedHeadersMap.others]),
          deduction_pending_cod: parseNumericValue(row[dedHeadersMap.pending_cod]),
          deduction_hq_penalty: parseNumericValue(row[dedHeadersMap.hq_penalty]),
          deduction_duitnow_penalty: parseNumericValue(row[dedHeadersMap.duitnow_penalty]),
          deduction_late_cod_penalty: parseNumericValue(row[dedHeadersMap.late_cod_penalty]),
          deduction_lost_individual: parseNumericValue(row[dedHeadersMap.lost_individual]),
          deduction_lost_parcel_hub: parseNumericValue(row[dedHeadersMap.lost_parcel_hub]),
          lost_pic_signed: 0,
          lost_rate: 0,
          total_all_lost_shared: 0,
          lost_parcel_pic_signed: 0,
          arbi_individual: 0,
          rcgen_penalty: 0,
          qc_penalty: 0,
          total_hq_penalty_detail: 0
        });
      });

      // 3. Calculate IC Conflict Warnings (1 NRIC with different names)
      const icWarnings = [];
      Object.entries(icToNames).forEach(([ic, namesSet]) => {
        if (namesSet.size > 1) {
          const names = Array.from(namesSet);
          icWarnings.push(`No. IC ${ic} dikaitkan dengan ${namesSet.size} nama berbeza: ${names.join(', ')}`);
        }
      });
      const warningsStr = icWarnings.length > 0 ? icWarnings.join('; ') : null;

      // 4. Database Transaction Block
      this.uploadProgress.set(commBatchId, { status: 'IMPORTING', progress: 50, totalRecords: commissionRecords.length + deductionRecords.length, processedRecords: 0 });

      const latestCommVer = await uploadRepository.getMaxVersionForPeriod(month, year);
      const version = latestCommVer + 1;
      const previousCommBatchId = await uploadRepository.findLatestActiveBatch(month, year, 'COMMISSION');
      const previousDedBatchId = await uploadRepository.findLatestActiveBatch(month, year, 'DEDUCTION');

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (existingCommBatch && overwrite) {
          await uploadRepository.deleteBatchWithClient(client, existingCommBatch.id);
        }
        if (existingDedBatch && overwrite) {
          await uploadRepository.deleteBatchWithClient(client, existingDedBatch.id);
        }

        await uploadRepository.upsertDispatcherMappings(client, dispatcherMappings);

        const commBatch = await uploadRepository.createBatch(client, {
          id: commBatchId,
          name: batchName,
          month,
          year,
          status: 'DRAFT',
          active: false,
          filename,
          type: 'COMMISSION',
          checksum: commChecksum,
          recordCount: commissionRecords.length,
          uploadedBy: uploaderId,
          version,
          previousBatchId: previousCommBatchId,
          warnings: warningsStr
        });

        const dedBatch = await uploadRepository.createBatch(client, {
          id: dedBatchId,
          name: batchName,
          month,
          year,
          status: 'DRAFT',
          active: false,
          filename,
          type: 'DEDUCTION',
          checksum: dedChecksum,
          recordCount: deductionRecords.length,
          uploadedBy: uploaderId,
          version,
          previousBatchId: previousDedBatchId,
          warnings: warningsStr
        });

        await uploadRepository.bulkInsertCommissionRecords(client, commBatch.id, commissionRecords);
        await uploadRepository.bulkInsertDeductionRecords(client, dedBatch.id, deductionRecords);

        await client.query('COMMIT');

        await auditLogService.logSuccessLogin(uploaderId, req, { action: 'UPLOAD_BATCH_SUCCESS', filename, commBatchId, dedBatchId });

        return {
          commBatchId,
          dedBatchId,
          commSummary: {
            recordsImported: commissionRecords.length,
            recordsSkipped: commRows.length - commissionRecords.length,
            duplicates: 0,
            errors: 0
          },
          dedSummary: {
            recordsImported: deductionRecords.length,
            recordsSkipped: dedRows.length - deductionRecords.length,
            duplicates: 0,
            errors: 0
          },
          warnings: icWarnings
        };

      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw new AppError(`Database transaction failure: ${dbErr.message}`, 500, 'DATABASE_TRANSACTION_FAILURE');
      } finally {
        client.release();
      }

    } finally {
      this.activeLocks.delete(commChecksum);
      this.uploadProgress.delete(commBatchId);
    }
  }
}

const uploadServiceInstance = new UploadService();
uploadServiceInstance.parseNumericValue = parseNumericValue;
uploadServiceInstance.parseIntegerValue = parseIntegerValue;

module.exports = uploadServiceInstance;
