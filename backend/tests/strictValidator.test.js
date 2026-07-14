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
    // Missing final_amount_to_pay
    const headers = [
      'Delivery Dispatcher ID',
      'Delivery Dispatcher Name',
      'Parcel Quantity',
      'Net Parcel',
      'RM1.15/Parcel Commission',
      'Exclude Extra Weight YOYI',
      'Extra Weight Commission',
      'Total Commission',
      'NETT COMMISSION'
    ];
    const wb = createMockWorkbook('Komisen', headers, [['DSP001', 'Test User', 100, 95, 109.25, 5, 10, 119.25, 119.25]]);
    
    assert.throws(() => {
      uploadService.validateExcelFormat(wb, 'COMMISSION');
    }, /Fail Excel tidak sah: Lajur wajib berikut tidak ditemui: final_amount_to_pay/);
  });

  it('should WARNING and proceed if extra unrecognized columns are present', () => {
    const headers = [
      'Delivery Dispatcher ID',
      'Delivery Dispatcher Name',
      'Parcel Quantity',
      'Net Parcel',
      'RM1.15/Parcel Commission',
      'Exclude Extra Weight YOYI',
      'Extra Weight Commission',
      'Total Commission',
      'NETT COMMISSION',
      'FINAL AMOUNT TO PAY',
      'COL_TAMBAHAN_ASDF' // Extra column
    ];
    const wb = createMockWorkbook('Commission', headers, [['DSP001', 'Test User', 100, 95, 109.25, 5, 10, 119.25, 119.25, 119.25, 'Ignore Me']]);
    
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
      'Net Parcel',
      'RM1.15/Parcel\r\nCommission',
      'Exclude Extra Weight YOYI',
      'Extra Weight Commission',
      'Total Commission',
      'NETT\nCOMMISSION',
      'FINAL AMOUNT TO PAY'
    ];
    const wb = createMockWorkbook('komisen', headers, [['DSP001', 'Test User', 100, 95, 109.25, 5, 10, 119.25, 119.25, 119.25]]);
    
    const result = uploadService.validateExcelFormat(wb, 'COMMISSION');
    assert.equal(result.isValid, true);
    assert.equal(result.warnings.length, 0); // All matched successfully
  });
});
