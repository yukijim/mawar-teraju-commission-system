const assert = require('assert');
const SimpleZipGenerator = require('../src/utils/zipGenerator');
const SimplePdfGenerator = require('../src/utils/pdfGenerator');

/**
 * Automated test suite for Bulk Payslips ZIP Generator & PDF Bundling engine.
 */
function runBulkPayslipsVerification() {
  console.log('[Bulk Payslips Test] Starting ZIP & PDF bundling verification...');

  // 1. Verify SimpleZipGenerator functionality
  const zip = new SimpleZipGenerator();
  const mockBuffer1 = Buffer.from('%PDF-1.4 Test PDF Content 1 %%EOF');
  const mockBuffer2 = Buffer.from('%PDF-1.4 Test PDF Content 2 %%EOF');

  zip.addFile('Payslip_NSN3052004_Amirul.pdf', mockBuffer1);
  zip.addFile('Payslip_NSN3052005_Badrul.pdf', mockBuffer2);

  const zipBuffer = zip.generate();
  console.log(`Compiled ZIP archive size: ${zipBuffer.length} bytes`);

  assert.ok(zipBuffer.length > 50, 'ZIP buffer should not be empty');
  assert.strictEqual(zipBuffer.readUInt32LE(0), 0x04034b50, 'ZIP buffer must start with PK local header signature (0x04034b50)');

  // Verify PKZIP structure contains filenames
  const zipString = zipBuffer.toString('binary');
  assert.ok(zipString.includes('Payslip_NSN3052004_Amirul.pdf'), 'ZIP archive missing first PDF filename');
  assert.ok(zipString.includes('Payslip_NSN3052005_Badrul.pdf'), 'ZIP archive missing second PDF filename');

  // 2. Verify generating actual PDF payslips and bundling into ZIP
  console.log('[Bulk Payslips Test] Bundling actual compiled PDF payslips...');
  const fullZip = new SimpleZipGenerator();

  const mockRecords = [
    {
      id: 'comm-uuid-1',
      batch_id: 'batch-uuid-99',
      batch_name: 'July 2026 Payment Cycle',
      dispatcher_id: 'NSN3052004',
      ic_number: '070614101708',
      name: 'Muhammad Amirul bin Syed Mohd Noor',
      parcel_qty: 450,
      net_parcel: 420,
      exclude_extra_weight_yoyi: 30,
      commission_rate: 466.20,
      extra_weight_commission: 12.80,
      total_commission: 479.00,
      nett_commission: 479.00,
      final_amount_to_pay: 479.00,
      month: 7,
      year: 2026,
      published_at: new Date('2026-07-11T10:00:00Z')
    },
    {
      id: 'comm-uuid-2',
      batch_id: 'batch-uuid-99',
      batch_name: 'July 2026 Payment Cycle',
      dispatcher_id: 'NSN3052005',
      ic_number: '920101105544',
      name: 'Siti Nurhaliza binti Ahmad',
      parcel_qty: 310,
      net_parcel: 300,
      exclude_extra_weight_yoyi: 10,
      commission_rate: 350.00,
      extra_weight_commission: 5.00,
      total_commission: 355.00,
      nett_commission: 355.00,
      final_amount_to_pay: 355.00,
      month: 7,
      year: 2026,
      published_at: new Date('2026-07-11T10:00:00Z')
    }
  ];

  mockRecords.forEach(record => {
    const pdfBuf = SimplePdfGenerator.generateCombinedPdf(record, 'admin_tester', '127.0.0.1');
    const pdfStr = pdfBuf.toString('utf-8');
    
    assert.ok(pdfStr.startsWith('%PDF-1.4'), `PDF for ${record.dispatcher_id} must start with %PDF-1.4`);
    assert.ok(pdfStr.includes('%%EOF'), `PDF for ${record.dispatcher_id} must contain %%EOF trailer`);
    assert.ok(pdfStr.includes(record.dispatcher_id), `PDF for ${record.dispatcher_id} must contain dispatcher ID`);

    const cleanDispId = record.dispatcher_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    fullZip.addFile(`Payslip_${cleanDispId}_${cleanName}.pdf`, pdfBuf);
  });

  const fullZipBuffer = fullZip.generate();
  console.log(`Full ZIP compiled size: ${fullZipBuffer.length} bytes with ${mockRecords.length} payslips.`);
  assert.ok(fullZipBuffer.length > 5000, 'Compiled ZIP containing 2 PDFs should be greater than 5KB');

  console.log('[Bulk Payslips Test] All checks passed successfully! Bulk ZIP payslip generator is 100% operational.');
}

runBulkPayslipsVerification();
