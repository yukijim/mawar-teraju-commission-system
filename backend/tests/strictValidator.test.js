const assert = require('assert');
const { describe, it } = require('node:test');
const XLSX = require('xlsx');

describe('Strict Excel Header & Sheet Validator Tests', () => {
  const uploadService = require('../src/services/uploadService');

  function createMockWorkbook(sheetName, headers, rows = [[]]) {
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }

  // --- SHEET EXISTENCE TESTS ---
  it('should REJECT upload if required Commission sheet is missing', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Dummy']]), 'Raw Data');
    assert.throws(() => {
      uploadService.validateExcelFormat(wb, 'COMMISSION');
    }, /Fail Excel tidak sah: Lembaran "Commission" atau "Komisen" tidak ditemui/);
  });

  it('should REJECT upload if required Deduction sheet is missing', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Dummy']]), 'Raw Data');
    assert.throws(() => {
      uploadService.validateExcelFormat(wb, 'DEDUCTION');
    }, /Fail Excel tidak sah: Lembaran "Deduction" atau "Potongan" tidak ditemui/);
  });

  // --- COMMISSION COLUMN-SPECIFIC REJECTION TESTS ---
  const validCommHeaders = [
    'Delivery Dispatcher IC No.',
    'Delivery Dispatcher ID',
    'Delivery Dispatcher Name',
    'Parcel Quantity',
    'Parcel Commission',
    'Extra Weight Commission',
    'Total Commission',
    'ADD: REFUND PENALTY',
    'ADD: PICKUP COMMISSION',
    'ADD: OTHERS',
    'ADD: SORTER',
    'ADD: EXTRA REWARD',
    'NETT COMMISSION'
  ];

  const commMappingKeys = {
    'Delivery Dispatcher IC No.': 'ic_number',
    'Delivery Dispatcher ID': 'dispatcher_id',
    'Delivery Dispatcher Name': 'name',
    'Parcel Quantity': 'parcel_qty',
    'Parcel Commission': 'parcel_commission',
    'Extra Weight Commission': 'extra_weight_commission',
    'Total Commission': 'total_commission',
    'ADD: REFUND PENALTY': 'refund_penalty',
    'ADD: PICKUP COMMISSION': 'pickup_commission',
    'ADD: OTHERS': 'others',
    'ADD: SORTER': 'sorter',
    'ADD: EXTRA REWARD': 'extra_reward',
    'NETT COMMISSION': 'nett_commission'
  };

  validCommHeaders.forEach(col => {
    it(`should REJECT if "${col}" is missing from Commission sheet`, () => {
      const headers = validCommHeaders.filter(h => h !== col);
      const row = new Array(headers.length).fill(0);
      const wb = createMockWorkbook('Commission', headers, [row]);
      
      const missingKey = commMappingKeys[col];
      assert.throws(() => {
        uploadService.validateExcelFormat(wb, 'COMMISSION');
      }, new RegExp(`Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: .*${missingKey}`));
    });
  });

  // --- DEDUCTION COLUMN-SPECIFIC REJECTION TESTS ---
  const validDedHeaders = [
    'Delivery Dispatcher IC No.',
    'Delivery Dispatcher ID',
    'Delivery Dispatcher Name',
    'DEDUCTION: ADVANCE',
    'DEDUCTION: PENDING COD',
    'DEDUCTION: HQ PENALTY',
    'DEDUCTION: DUITNOW PENALTY',
    'DEDUCTION: LATE COD PENALTY',
    'DEDUCTION: LOST INDIVIDUAL',
    'DEDUCTION: LOST PARCEL HUB'
  ];

  const dedMappingKeys = {
    'Delivery Dispatcher IC No.': 'ic_number',
    'Delivery Dispatcher ID': 'dispatcher_id',
    'Delivery Dispatcher Name': 'name',
    'DEDUCTION: ADVANCE': 'others',
    'DEDUCTION: PENDING COD': 'pending_cod',
    'DEDUCTION: HQ PENALTY': 'hq_penalty',
    'DEDUCTION: DUITNOW PENALTY': 'duitnow_penalty',
    'DEDUCTION: LATE COD PENALTY': 'late_cod_penalty',
    'DEDUCTION: LOST INDIVIDUAL': 'lost_individual',
    'DEDUCTION: LOST PARCEL HUB': 'lost_parcel_hub'
  };

  validDedHeaders.forEach(col => {
    it(`should REJECT if "${col}" is missing from Deduction sheet`, () => {
      const headers = validDedHeaders.filter(h => h !== col);
      const row = new Array(headers.length).fill(0);
      const wb = createMockWorkbook('Deduction', headers, [row]);
      
      const missingKey = dedMappingKeys[col];
      assert.throws(() => {
        uploadService.validateExcelFormat(wb, 'DEDUCTION');
      }, new RegExp(`Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: .*${missingKey}`));
    });
  });

  // --- WARNING & PERMUTATION TESTS ---
  it('should WARNING and proceed if extra unrecognized columns are present', () => {
    const headers = [...validCommHeaders, 'COL_TAMBAHAN_ASDF'];
    const row = [...new Array(validCommHeaders.length).fill(0), 'Ignore Me'];
    const wb = createMockWorkbook('Commission', headers, [row]);
    
    const result = uploadService.validateExcelFormat(wb, 'COMMISSION');
    assert.equal(result.isValid, true);
    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes('COL_TAMBAHAN_ASDF'));
  });

  it('should successfully match headers with whitespace/newline variations', () => {
    const headers = [
      '  Delivery \r\n Dispatcher \t IC No.  ',
      'Delivery Dispatcher ID',
      'Delivery Dispatcher Name',
      'Parcel\nQuantity',
      'Parcel\r\nCommission',
      'Extra Weight Commission',
      'Total Commission',
      'ADD:\nREFUND PENALTY',
      'ADD: PICKUP\tCOMMISSION',
      'ADD:\r\nOTHERS',
      'add: sorter',
      'add:\nEXTRA REWARD',
      'NETT\nCOMMISSION'
    ];
    const wb = createMockWorkbook('komisen', headers, [new Array(headers.length).fill(0)]);
    
    const result = uploadService.validateExcelFormat(wb, 'COMMISSION');
    assert.equal(result.isValid, true);
    assert.equal(result.warnings.length, 0);
  });
});
