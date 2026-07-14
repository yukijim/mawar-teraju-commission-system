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

  it('should REJECT upload if required columns are missing in Commission sheet', () => {
    // Missing nett_commission
    const headers = [
      'Delivery Dispatcher ID',
      'Delivery Dispatcher Name',
      'Parcel Quantity',
      'RM1.15/Parcel Commission',
      'Extra Weight Commission',
      'Total Commission',
      'ADDITION: REFUND 15JUNE26',
      'ADDITION: PICKUP COMMISSION',
      'system reg',
      'add: sorter'
    ];
    const wb = createMockWorkbook('Komisen', headers, [['DSP001', 'Test User', 100, 109.25, 10, 119.25, 15, 25, 'REG123', 5]]);
    
    assert.throws(() => {
      uploadService.validateExcelFormat(wb, 'COMMISSION');
    }, /Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: nett_commission/);
  });

  it('should WARNING and proceed if extra unrecognized columns are present', () => {
    const headers = [
      'Delivery Dispatcher ID',
      'Delivery Dispatcher Name',
      'Parcel Quantity',
      'RM1.15/Parcel Commission',
      'Extra Weight Commission',
      'Total Commission',
      'ADDITION: REFUND 15JUNE26',
      'ADDITION: PICKUP COMMISSION',
      'system reg',
      'add: sorter',
      'NETT COMMISSION',
      'COL_TAMBAHAN_ASDF' // Extra column
    ];
    const wb = createMockWorkbook('Commission', headers, [['DSP001', 'Test User', 100, 109.25, 10, 119.25, 15, 25, 'REG123', 5, 119.25, 'Ignore Me']]);
    
    const result = uploadService.validateExcelFormat(wb, 'COMMISSION');
    assert.equal(result.isValid, true);
    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes('COL_TAMBAHAN_ASDF'));
  });

  it('should successfully match headers with whitespace/newline variations', () => {
    const headers = [
      '  Delivery \r\n Dispatcher \t ID  ', // whitespace and newlines
      'Delivery Dispatcher Name',
      'Parcel\nQuantity',
      'RM1.15/Parcel\r\nCommission',
      'Extra Weight Commission',
      'Total Commission',
      'ADDITION:\nREFUND 15JUNE26',
      'ADDITION: PICKUP\tCOMMISSION',
      'system\r\nreg',
      'add: sorter',
      'NETT\nCOMMISSION'
    ];
    const wb = createMockWorkbook('komisen', headers, [['DSP001', 'Test User', 100, 109.25, 10, 119.25, 15, 25, 'REG123', 5, 119.25]]);
    
    const result = uploadService.validateExcelFormat(wb, 'COMMISSION');
    assert.equal(result.isValid, true);
    assert.equal(result.warnings.length, 0); // All matched successfully
  });
});
