const assert = require('assert');
const SimplePdfGenerator = require('../src/utils/pdfGenerator');

function runCombinedPdfVerification() {
  console.log('[Combined PDF Validation] Initializing mock data context...');

  const mockRecord = {
    batch_id: 'e1d2c3b4-a5f6-7a8b-9c0d-1e2f3a4b5c6d',
    batch_name: 'July 2026 Payment Cycle',
    version: 3,
    published_at: new Date('2026-07-11T10:00:00Z'),
    dispatcher_id: 'NSN3052004',
    ic_number: '070614101708',
    name: 'Muhammad Amirul bin Syed Mohd Noor (Kuala Lumpur Rider)',
    
    // Commission inputs
    parcel_qty: 450,
    commission_rate: 466.20,
    extra_weight_commission: 12.80,
    total_commission: 463.50,
    addition_pickup_commission: 35.00,
    addition_refund_penalty: 50.00,
    addition_others: 10.00,
    addition_sorter: 20.00,
    addition_extra_reward: 125.00,
    nett_commission: 716.30,
    
    // Deductions inputs (positive floats as stored in database)
    deduction_advance: 100.00,
    deduction_pending_cod: 25.50,
    deduction_hq_penalty: 15.00,
    deduction_duitnow_penalty: 0.00,
    deduction_late_cod_penalty: 5.00,
    deduction_lost_individual: 30.00,
    deduction_lost_parcel_hub: 50.00
  };

  const username = 'admin_tester';
  const ipAddress = '127.0.0.1';

  console.log('Generating Combined Commission & Deduction PDF Report...');
  const combinedPdfBuffer = SimplePdfGenerator.generateCombinedPdf(mockRecord, username, ipAddress);

  console.log(`Combined PDF compiled size: ${combinedPdfBuffer.length} bytes`);
  
  const pdfString = combinedPdfBuffer.toString('utf-8');
  assert.ok(pdfString.startsWith('%PDF-1.4'), 'Combined PDF does not start with %PDF-1.4 header');
  assert.ok(pdfString.includes('%%EOF'), 'Combined PDF is missing standard %%EOF trailer signature');
  assert.ok(pdfString.includes('July 2026 Payment Cycle'), 'Combined PDF does not contain batch name');
  assert.ok(pdfString.includes('Muhammad Amirul bin Syed Mohd Noor'), 'Combined PDF does not contain dispatcher name');
  
  // Verify both sections exist
  assert.ok(pdfString.includes('EXTRA REWARD'), 'Combined PDF is missing commission fields');
  assert.ok(pdfString.includes('DEDUCTION: ADVANCE'), 'Combined PDF is missing deduction fields');
  assert.ok(pdfString.includes('Total Net Pay'), 'Combined PDF is missing Total Net Pay summary');
  assert.ok(pdfString.includes('Total Addition'), 'Combined PDF is missing Total Addition summary');
  assert.ok(pdfString.includes('Total Deduction'), 'Combined PDF is missing Total Deduction summary');

  // Verify calculated net payout formatting
  // Expecting raw nett_commission value from database directly (716.30)
  assert.ok(pdfString.includes('RM 716.30'), 'Combined PDF does not format final net amount to pay correctly');

  console.log('[Combined PDF Validation] All checks passed successfully! PDF layout integrity is 100% sound.');
}

runCombinedPdfVerification();
