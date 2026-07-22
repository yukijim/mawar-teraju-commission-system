const XLSX = require('xlsx');
const db = require('../config/database');
const penaltyRepository = require('../repositories/penaltyRepository');
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

/**
 * Service managing penalty operations, parsing files, and calling repository layer.
 */
class PenaltyService {
  PENALTY_MAPPING_RULES = {
    delivery_dispatcher_id: ['delivery dispatcher id', 'dispatcher id', 'delivery dispatcher', 'id dispatcher', 'dispatcher_id', 'delivery_dispatcher_id'],
    delivery_dispatcher_name: ['delivery dispatcher name', 'dispatcher name', 'nama dispatcher', 'name', 'dispatcher_name', 'delivery_dispatcher_name'],
    awb: ['awb', 'awb number', 'awb no', 'awb no.', 'no awb', 'no. awb', 'awb_number', 'awb_no'],
    fake_return: ['fake return', 'return fake', 'fake_return'],
    fake_problematic: ['fake problematic', 'problematic fake', 'fake_problematic'],
    fraud_delivery: ['fraud delivery', 'delivery fraud', 'fraud_delivery'],
    arbitration: ['arbitration', 'arbitrasi'],
    individual_lost: ['individual lost', 'lost individual', 'individual_lost'],
    logic: ['logic', 'logik']
  };

  /**
   * Validates structure and headers of the Penalty sheet.
   */
  validateExcelFormat(workbook) {
    const sheetNames = workbook.SheetNames;
    const targetSheetName = sheetNames.find(n => {
      if (!n) return false;
      const normalized = n.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
      return normalized === 'penalty' || normalized === 'denda';
    });

    if (!targetSheetName) {
      throw new AppError(`Fail Excel tidak sah: Lembaran "Penalty" atau "Denda" tidak ditemui. Senarai sheet sebenar: [${sheetNames.join(', ')}]`, 400, 'UPLOAD_INVALID_TEMPLATE');
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
      for (const [key, aliases] of Object.entries(this.PENALTY_MAPPING_RULES)) {
        const normAliases = aliases.map(a => normalizeHeader(a));
        if (normAliases.includes(cleanHeader)) {
          matchedKeys.add(key);
          recognized = true;
          break;
        }
      }
      if (!recognized && cleanHeader !== '') {
        warnings.push(`Amaran: Kolum tidak dikenali "${header}" dijumpai dan akan diabaikan.`);
      }
    });

    const requiredKeys = [
      'delivery_dispatcher_id', 'delivery_dispatcher_name', 'awb', 
      'fake_return', 'fake_problematic', 'fraud_delivery', 
      'arbitration', 'individual_lost', 'logic'
    ];

    const missingKeys = requiredKeys.filter(key => !matchedKeys.has(key));
    if (missingKeys.length > 0) {
      throw new AppError(`Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: ${missingKeys.join(', ')} dalam sheet ${targetSheetName}.`, 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    return {
      sheetName: targetSheetName,
      warnings
    };
  }

  /**
   * Imports Excel file into penalty_records table.
   */
  async importPenalty(fileBuffer, filename, uploaderId, req) {
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      throw new AppError('Failed to read Excel workbook. File might be corrupted.', 400, 'UPLOAD_INVALID_TEMPLATE');
    }

    const validation = this.validateExcelFormat(workbook);
    const sheetName = validation.sheetName;
    const sheet = workbook.Sheets[sheetName];
    const rows = getSheetRows(sheet);

    const startTime = Date.now();

    let client;
    try {
      client = await db.connect();
    } catch (dbErr) {
      if (dbErr.code === 'ECONNREFUSED' || dbErr.message?.includes('ECONNREFUSED')) {
        console.warn('[PenaltyService] PostgreSQL connection refused, running import using in-memory store.');
        client = null;
      } else {
        throw dbErr;
      }
    }

    try {
      if (client) await client.query('BEGIN');

      // Resolve valid UUID for uploader_by
      let validUploaderId = uploaderId;
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uploaderId || '');
      if (!isUuid && client) {
        const userRes = await client.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1");
        if (userRes.rows.length > 0) {
          validUploaderId = userRes.rows[0].id;
        }
      }

      const penaltyRecords = [];
      const firstRow = rows[0];
      const headersMap = {};

      Object.keys(this.PENALTY_MAPPING_RULES).forEach(key => {
        headersMap[key] = null;
      });

      Object.keys(firstRow).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(this.PENALTY_MAPPING_RULES)) {
          const normAliases = aliases.map(a => normalizeHeader(a));
          if (normAliases.includes(cleanHeader)) {
            headersMap[key] = header;
            break;
          }
        }
      });

      rows.forEach(row => {
        const rawId = row[headersMap.delivery_dispatcher_id];
        const rawName = row[headersMap.delivery_dispatcher_name];
        const rawAwb = row[headersMap.awb];

        if (!rawId || rawId.toString().trim() === '' || !rawAwb || rawAwb.toString().trim() === '') {
          return; // Skip empty rows or missing dispatcher/AWB
        }

        penaltyRecords.push({
          delivery_dispatcher_id: rawId.toString().trim(),
          delivery_dispatcher_name: rawName ? rawName.toString().trim() : '',
          awb: rawAwb.toString().trim(),
          fake_return: parseNumericValue(row[headersMap.fake_return]),
          fake_problematic: parseNumericValue(row[headersMap.fake_problematic]),
          fraud_delivery: parseNumericValue(row[headersMap.fraud_delivery]),
          arbitration: parseNumericValue(row[headersMap.arbitration]),
          individual_lost: parseNumericValue(row[headersMap.individual_lost]),
          logic: parseNumericValue(row[headersMap.logic]),
          uploaded_by: validUploaderId
        });
      });

      if (penaltyRecords.length === 0) {
        throw new AppError('Tiada rekod penalty yang sah untuk diimport.', 400, 'UPLOAD_EMPTY_RECORDS');
      }

      // Chunk inserts in 500 records
      const chunkSize = 500;
      for (let i = 0; i < penaltyRecords.length; i += chunkSize) {
        const chunk = penaltyRecords.slice(i, i + chunkSize);
        await penaltyRepository.bulkInsertPenaltyRecords(client, chunk);
      }

      if (client) await client.query('COMMIT');
      await auditLogService.logSuccessLogin(uploaderId, req, { action: 'PENALTY_UPLOAD_SUCCESS', filename, recordCount: penaltyRecords.length }).catch(() => {});

      const duration = Date.now() - startTime;
      return {
        warnings: validation.warnings,
        summary: {
          recordsImported: penaltyRecords.length,
          duration
        }
      };
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      await auditLogService.logFailedLogin(req.user?.username || 'Unknown Admin', req, { action: 'PENALTY_UPLOAD_FAILED', reason: err.message, filename }).catch(() => {});
      throw err;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Search all detailed AWB penalty rows for a dispatcher
   */
  async searchPenalties(dispatcherId) {
    if (!dispatcherId) {
      throw new AppError('Dispatcher ID diperlukan.', 400, 'SEARCH_VALIDATION_ERROR');
    }
    const cleanId = dispatcherId.toString().trim().toUpperCase();
    const records = await penaltyRepository.searchPenaltyRecords(cleanId);
    return records;
  }
}

module.exports = new PenaltyService();
