const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const db = require('../src/config/database');
const uploadService = require('../src/services/uploadService');
const searchService = require('../src/services/searchService');

describe('Integration Tests: Upload & Search Debug', () => {
  let adminId;

  before(async () => {
    // Fetch a valid admin ID for the upload mock
    const adminRes = await db.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    adminId = adminRes.rows[0]?.id;

    // Clean up test data if any
    await db.query("DELETE FROM dispatcher_mappings WHERE dispatcher_id = 'TST123' OR dispatcher_id = 'TST456'");
    await db.query("DELETE FROM commission_records WHERE dispatcher_id = 'TST123' OR dispatcher_id = 'TST456'");
    await db.query("DELETE FROM batches WHERE name = 'TEST_INTEGRATION_BATCH'");
  });

  after(async () => {
    // Clean up test data
    await db.query("DELETE FROM dispatcher_mappings WHERE dispatcher_id = 'TST123' OR dispatcher_id = 'TST456'");
    await db.query("DELETE FROM commission_records WHERE dispatcher_id = 'TST123' OR dispatcher_id = 'TST456'");
    await db.query("DELETE FROM batches WHERE name = 'TEST_INTEGRATION_BATCH'");
    await db.end();
  });

  it('should successfully resolve empty ICs and import 8-character passports', async () => {
    // 1. First insert a mapping in the database for TST123 (which has a missing NRIC in the import)
    await db.query(
      "INSERT INTO dispatcher_mappings (dispatcher_id, ic_number, name) VALUES ('TST123', '990101149999', 'TEST RIDER ONE')"
    );

    // Create a mock workbook with Commission sheet
    // Row 1: TST123 with EMPTY IC (it should resolve from mappings: 990101149999)
    // Row 2: TST456 with Passport "E7431725" (length 8, should not be skipped)
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    
    const headers = [
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
    
    const row1 = ['', 'TST123', 'TEST RIDER ONE', 10, 1.0, 0.0, 10.0, 0.0, 0.0, 0.0, 0.0, 5.0, 15.0];
    const row2 = ['E7431725', 'TST456', 'TEST RIDER TWO', 20, 1.0, 0.0, 20.0, 0.0, 0.0, 0.0, 0.0, 10.0, 30.0];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, row1, row2]);
    XLSX.utils.book_append_sheet(wb, ws, 'Commission');

    // Also add a Deduction sheet with at least one record to satisfy validation
    const dedHeaders = [
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
    const rowDed = ['', 'TST123', 'TEST RIDER ONE', 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    const wsDed = XLSX.utils.aoa_to_sheet([dedHeaders, rowDed]);
    XLSX.utils.book_append_sheet(wb, wsDed, 'Deduction');

    const fileBuffer = XLSX.write(wb, { type: 'buffer' });

    // Call importBatch
    const result = await uploadService.importBatch(fileBuffer, 'test_batch.xlsx', adminId, {
      month: 12,
      year: 2026,
      name: 'TEST_INTEGRATION_BATCH',
      overwrite: 'true'
    });

    assert.ok(result.commBatchId);
    assert.ok(result.dedBatchId);
    assert.strictEqual(result.commSummary.recordsImported, 2); // Both rows should be imported!
    
    // Also publish it so it becomes visible for search
    await uploadService.publishBatch(result.commBatchId, adminId, { headers: {} });
  });

  it('should successfully search for passport E7431725 (public and login)', async () => {
    // Perform public search by ic_number
    const publicResult = await searchService.executeSearch(null, {
      ic_number: 'E7431725'
    }, '127.0.0.1');

    assert.ok(publicResult.records.length > 0);
    assert.strictEqual(publicResult.records[0].dispatcherInfo.dispatcherId, 'TST456');

    // Perform dispatcher login search by username
    const mockUser = {
      id: adminId,
      username: 'E7431725',
      role: 'DISPATCH'
    };
    const loggedInResult = await searchService.executeSearch(mockUser, {}, '127.0.0.1');
    assert.ok(loggedInResult.records.length > 0);
    assert.strictEqual(loggedInResult.records[0].dispatcherInfo.dispatcherId, 'TST456');
  });

  it('should successfully search for empty IC rider TST123 using resolved NRIC', async () => {
    // Perform search by dispatcher ID
    const searchById = await searchService.executeSearch(null, {
      dispatcher_id: 'TST123'
    }, '127.0.0.1');

    assert.ok(searchById.records.length > 0);
    assert.strictEqual(searchById.records[0].dispatcherInfo.icNumber, '990101149999');
  });
});
