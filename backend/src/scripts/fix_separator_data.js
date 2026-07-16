/**
 * Production Data Correction Script
 * Updates numeric cells in-place for a specific batch period without breaking version history.
 * Usage: node backend/src/scripts/fix_separator_data.js <path_to_excel> <month> <year>
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

// Reuse parsing logic from uploadService
const parseNumericValue = (val) => {
  if (val === undefined || val === null) return 0.00;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.00 : parsed;
};

const parseIntegerValue = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.round(val);
  const cleaned = val.toString().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
};

const normalizeHeader = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\xa0\u2007\u202F\u205F\u3000]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const COMMISSION_MAPPING_RULES = {
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

const DEDUCTION_MAPPING_RULES = {
  ic_number: ['delivery dispatcher ic no', 'delivery dispatcher ic no.'],
  dispatcher_id: ['delivery dispatcher id'],
  name: ['delivery dispatcher name'],
  advance: ['deduction advance', 'deduction: advance'],
  pending_cod: ['deduction pending cod', 'deduction: pending cod'],
  hq_penalty: ['deduction hq penalty', 'deduction: hq penalty'],
  duitnow_penalty: ['deduction duitnow penalty', 'deduction: duitnow penalty'],
  late_cod_penalty: ['deduction late cod penalty', 'deduction: late cod penalty'],
  lost_individual: ['deduction lost individual', 'deduction: lost individual'],
  lost_parcel_hub: ['deduction lost parcel hub', 'deduction: lost parcel hub']
};

const getSheetRows = (sheet) => {
  if (!sheet || !sheet['!ref']) return [];
  const XLSX_LIB = require('xlsx');
  const range = XLSX_LIB.utils.decode_range(sheet['!ref']);
  let headerRowIdx = range.s.r;
  
  for (let r = range.s.r; r <= range.e.r; r++) {
    let found = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX_LIB.utils.encode_cell({ r, c });
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
  return XLSX_LIB.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '', raw: false });
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: node backend/src/scripts/fix_separator_data.js <path_to_excel_file> <month> <year>");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  const month = parseInt(args[1], 10);
  const year = parseInt(args[2], 10);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist at ${filePath}`);
    process.exit(1);
  }

  console.log(`Starting data correction for Period: ${month}/${year}`);
  console.log(`Excel file: ${filePath}`);

  const XLSX_LIB = require('xlsx');
  const workbook = XLSX_LIB.readFile(filePath);

  // 1. Resolve Active Published Batches for the target period
  const batchRes = await db.query(
    "SELECT id, type, name, status, version FROM batches WHERE month = $1 AND year = $2 AND status = 'PUBLISHED' AND is_active = TRUE AND deleted_at IS NULL",
    [month, year]
  );

  if (batchRes.rows.length === 0) {
    console.error(`Error: No active PUBLISHED batches found for period ${month}/${year} in the database.`);
    process.exit(1);
  }

  const commBatch = batchRes.rows.find(b => b.type === 'COMMISSION');
  const dedBatch = batchRes.rows.find(b => b.type === 'DEDUCTION');

  console.log(`Found Published Commission Batch: ${commBatch ? commBatch.id : 'None'}`);
  console.log(`Found Published Deduction Batch: ${dedBatch ? dedBatch.id : 'None'}`);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 2. Process Commission Sheet
    if (commBatch) {
      const sheetName = workbook.SheetNames.find(n => {
        const norm = n.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
        return norm === 'commission' || norm === 'komisen';
      });

      if (!sheetName) {
        console.error("Error: Commission/Komisen sheet not found in the workbook.");
        process.exit(1);
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = getSheetRows(sheet);
      console.log(`Parsing Commission sheet "${sheetName}" with ${rows.length} rows...`);

      const commHeadersMap = {};
      Object.keys(COMMISSION_MAPPING_RULES).forEach(key => {
        commHeadersMap[key] = null;
      });
      Object.keys(rows[0]).forEach(header => {
        const cleanHeader = normalizeHeader(header);
        for (const [key, aliases] of Object.entries(COMMISSION_MAPPING_RULES)) {
          if (aliases.includes(cleanHeader)) {
            commHeadersMap[key] = header;
            break;
          }
        }
      });

      let updatedCommCount = 0;
      for (const row of rows) {
        const rawId = row[commHeadersMap.dispatcher_id];
        if (!rawId || rawId.toString().trim() === '') continue;
        const dispatcherId = rawId.toString().trim();

        const parcelQty = parseIntegerValue(row[commHeadersMap.parcel_qty]);
        const commissionRate = parseNumericValue(row[commHeadersMap.parcel_commission]);
        const extraWeightCommission = parseNumericValue(row[commHeadersMap.extra_weight_commission]);
        const totalCommission = parseNumericValue(row[commHeadersMap.total_commission]);
        const additionPickupCommission = parseNumericValue(row[commHeadersMap.pickup_commission]);
        const additionRefundPenalty = parseNumericValue(row[commHeadersMap.refund_penalty]);
        const additionOthers = parseNumericValue(row[commHeadersMap.others]);
        const additionSorter = parseNumericValue(row[commHeadersMap.sorter]);
        const additionExtraReward = parseNumericValue(row[commHeadersMap.extra_reward]);
        const nettCommission = parseNumericValue(row[commHeadersMap.nett_commission]);

        const updateRes = await client.query(
          `UPDATE commission_records 
           SET parcel_qty = $1, commission_rate = $2, extra_weight_commission = $3, 
               total_commission = $4, addition_pickup_commission = $5, 
               addition_refund_penalty = $6, addition_others = $7, addition_sorter = $8, 
               nett_commission = $9, final_amount_to_pay = $9, addition_extra_reward = $10
           WHERE batch_id = $11 AND dispatcher_id = $12`,
          [
            parcelQty, commissionRate, extraWeightCommission, 
            totalCommission, additionPickupCommission, 
            additionRefundPenalty, additionOthers, additionSorter, 
            nettCommission, additionExtraReward, commBatch.id, dispatcherId
          ]
        );
        if (updateRes.rowCount > 0) {
          updatedCommCount++;
        }
      }
      console.log(`Updated ${updatedCommCount} commission records in-place.`);
    }

    // 3. Process Deduction Sheet
    if (dedBatch) {
      const sheetName = workbook.SheetNames.find(n => {
        const norm = n.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
        return norm === 'deduction' || norm === 'potongan';
      });

      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rows = getSheetRows(sheet);
        console.log(`Parsing Deduction sheet "${sheetName}" with ${rows.length} rows...`);

        const dedHeadersMap = {};
        Object.keys(DEDUCTION_MAPPING_RULES).forEach(key => {
          dedHeadersMap[key] = null;
        });
        Object.keys(rows[0]).forEach(header => {
          const cleanHeader = normalizeHeader(header);
          for (const [key, aliases] of Object.entries(DEDUCTION_MAPPING_RULES)) {
            if (aliases.includes(cleanHeader)) {
              dedHeadersMap[key] = header;
              break;
            }
          }
        });

        let updatedDedCount = 0;
        for (const row of rows) {
          const rawId = row[dedHeadersMap.dispatcher_id];
          if (!rawId || rawId.toString().trim() === '') continue;
          const dispatcherId = rawId.toString().trim();

          const deductionAdvance = parseNumericValue(row[dedHeadersMap.advance]);
          const deductionPendingCod = parseNumericValue(row[dedHeadersMap.pending_cod]);
          const deductionHqPenalty = parseNumericValue(row[dedHeadersMap.hq_penalty]);
          const deductionDuitnowPenalty = parseNumericValue(row[dedHeadersMap.duitnow_penalty]);
          const deductionLateCodPenalty = parseNumericValue(row[dedHeadersMap.late_cod_penalty]);
          const deductionLostIndividual = parseNumericValue(row[dedHeadersMap.lost_individual]);
          const deductionLostParcelHub = parseNumericValue(row[dedHeadersMap.lost_parcel_hub]);

          const updateRes = await client.query(
            `UPDATE deduction_records 
             SET deduction_advance = $1, deduction_pending_cod = $2, deduction_hq_penalty = $3, 
                 deduction_duitnow_penalty = $4, deduction_late_cod_penalty = $5, 
                 deduction_lost_individual = $6, deduction_lost_parcel_hub = $7
             WHERE batch_id = $8 AND dispatcher_id = $9`,
            [
              deductionAdvance, deductionPendingCod, deductionHqPenalty, 
              deductionDuitnowPenalty, deductionLateCodPenalty, 
              deductionLostIndividual, deductionLostParcelHub, 
              dedBatch.id, dispatcherId
            ]
          );
          if (updateRes.rowCount > 0) {
            updatedDedCount++;
          }
        }
        console.log(`Updated ${updatedDedCount} deduction records in-place.`);
      } else {
        console.log("No deduction sheet found or mapped.");
      }
    }

    await client.query('COMMIT');
    console.log("Data correction successfully committed!");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during in-place correction transaction:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

main();
