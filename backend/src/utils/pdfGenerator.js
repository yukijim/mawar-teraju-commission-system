const crypto = require('crypto');

/**
 * Pure Node.js PDF compilation engine.
 * Generates standards-compliant A4 PDF documents with custom typography, 
 * borders, layout grids, logo paths, and xref byte-offset calculations.
 */
class SimplePdfGenerator {
  /**
   * Generates a Maroon-themed PDF Commission Report
   */
  static generateCommissionPdf(record, searcherUsername, ipAddress) {
    return this.buildPdf({
      title: 'MAWAR TERAJU COMMISSION REPORT',
      themeColor: '0.5 0 0', // Maroon in rgb PDF decimal (128, 0, 0)
      record,
      searcherUsername,
      ipAddress,
      type: 'commission'
    });
  }

  /**
   * Generates a Gold-themed PDF Deduction Details Report
   */
  static generateDeductionPdf(record, searcherUsername, ipAddress) {
    return this.buildPdf({
      title: 'MAWAR TERAJU DEDUCTION DETAILS',
      themeColor: '0.77 0.63 0.35', // Gold in rgb PDF decimal (197, 160, 89)
      record,
      searcherUsername,
      ipAddress,
      type: 'deduction'
    });
  }

  /**
   * Builds the PDF page objects and cross-reference table (xref)
   */
  static buildPdf({ title, themeColor, record, searcherUsername, ipAddress, type }) {
    // Generate unique reference number
    const refNum = `REF-${record.batch_id.substring(0, 8).toUpperCase()}-${crypto.createHash('sha256').update(record.ic_number).digest('hex').substring(0, 8).toUpperCase()}`;
    const publishDate = record.published_at ? new Date(record.published_at).toLocaleDateString() : 'N/A';
    const genTime = new Date().toLocaleString();

    // Stream contents configuration
    let stream = '';

    // Draw Mawar Teraju Logo (flower shape drawing vector paths)
    stream += `q\n`;
    stream += `${themeColor} rg\n`;
    stream += `10 0 0 10 50 780 cm\n`; // logo coordinates
    stream += `0 0 m 0 2 l 2 2 l 2 0 l f\n`; // square base
    stream += `Q\n`;

    // Title & References
    stream += `BT\n/F2 16 Tf\n50 755 Td\n(${title}) Tj\nET\n`;
    stream += `BT\n/F1 9 Tf\n50 740 Td\n(Rujukan: ${refNum}) Tj\nET\n`;

    // Divider Line
    stream += `0.5 w\n50 730 m\n545 730 l\nS\n`;

    // Period Details
    stream += `BT\n/F2 10 Tf\n50 710 Td\n(Batch / Period:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n130 710 Td\n(${record.batch_name}) Tj\nET\n`;
    stream += `BT\n/F2 10 Tf\n300 710 Td\n(Batch Version:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n380 710 Td\n(v${record.version || 1}) Tj\nET\n`;
    stream += `BT\n/F2 10 Tf\n50 695 Td\n(Published Date:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n130 695 Td\n(${publishDate}) Tj\nET\n`;

    // Dispatcher Details
    stream += `BT\n/F2 10 Tf\n50 670 Td\n(Dispatcher ID:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n130 670 Td\n(${record.dispatcher_id}) Tj\nET\n`;
    stream += `BT\n/F2 10 Tf\n300 670 Td\n(NRIC / IC Number:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n390 670 Td\n(${record.ic_number}) Tj\nET\n`;
    stream += `BT\n/F2 10 Tf\n50 655 Td\n(Name:) Tj\nET\n`;
    stream += `BT\n/F1 10 Tf\n130 655 Td\n(${record.name}) Tj\nET\n`;

    // Horizontal grid separator
    stream += `0.5 w\n50 640 m\n545 640 l\nS\n`;

    // Summary Box Header
    stream += `q\n0.95 0.95 0.95 rg\n50 610 495 20 re\nf\nQ\n`;
    stream += `BT\n/F2 10 Tf\n60 616 Td\n(Butiran Ringkasan Kewangan) Tj\nET\n`;

    let y = 580;
    const addRow = (label, val) => {
      const cleanVal = parseFloat(val || 0).toFixed(2);
      const line = `BT\n/F1 10 Tf\n60 ${y} Td\n(${label}) Tj\nET\nBT\n/F1 10 Tf\n480 ${y} Td\n(RM ${cleanVal}) Tj\nET\n`;
      y -= 18;
      return line;
    };

    if (type === 'commission') {
      stream += addRow('Parcel Quantity', record.parcel_qty);
      stream += addRow('Net Parcel Deliveries', record.net_parcel);
      stream += addRow('Exclude Extra Weight Yoyi', record.exclude_extra_weight_yoyi);
      stream += addRow('RM1.11 Commission Rate', record.commission_rate);
      stream += addRow('New Joiner Diff Rate', record.diff_rate_new_joiner);
      stream += addRow('Count of Pickup', record.count_pickup);
      stream += addRow('Extra Weight Commission', record.extra_weight_commission);
      stream += addRow('Total Gross Commission', record.total_commission);
      stream += addRow('Pickup Allowance Additions', record.addition_pickup_commission);
      stream += addRow('Fuel Allowance Additions', record.addition_fuel_allowance);
      stream += addRow('Sorter Allowance Additions', record.addition_sorter);
      stream += addRow('Deduction: Advance', record.deduction_advance);
      stream += addRow('Deduction: Pending COD', record.deduction_pending_cod);
      stream += addRow('Deduction: HQ Penalty', record.deduction_hq_penalty);
      stream += addRow('Deduction: DuitNow Penalty', record.deduction_duitnow_penalty);
      stream += addRow('Deduction: Late COD Penalty', record.deduction_late_cod_penalty);
      stream += addRow('Deduction: Lost Individual', record.deduction_lost_individual);
      stream += addRow('Deduction: Lost Parcel Hub', record.deduction_lost_parcel_hub);
      stream += addRow('Nett Commission', record.nett_commission);
      stream += addRow('Final Net Amount to Pay', record.final_amount_to_pay);
    } else {
      stream += addRow('HQ Penalty Summary (from Commission Sheet)', record.deduction_hq_penalty);
      stream += addRow('Lost Pic Signed Details', record.lost_pic_signed);
      stream += addRow('Lost Rate Details', record.lost_rate);
      stream += addRow('Lost Shared Penalty Details', record.total_all_lost_shared);
      stream += addRow('Lost Individual Penalty Details', record.lost_parcel_pic_signed);
      stream += addRow('Arbitration Penalty Details', record.arbi_individual);
      stream += addRow('RCGEN Penalty Details', record.rcgen_penalty);
      stream += addRow('QC Penalty Details', record.qc_penalty);
      stream += addRow('Total HQ Penalty details (from Deduction Sheet)', record.total_hq_penalty_detail);
    }

    // Footnote & Audit details
    stream += `0.5 w\n50 ${y + 5} m\n545 ${y + 5} l\nS\n`;
    stream += `BT\n/F1 8 Tf\n50 ${y - 12} Td\n(Penjana: ${searcherUsername} | IP Address: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
    stream += `BT\n/F1 8 Tf\n420 ${y - 12} Td\n(Dokumen ini adalah cetakan sistem komputer.) Tj\nET\n`;

    // Assemble PDF Object Indexes
    const header = '%PDF-1.4';
    const catalogIdx = 1;
    const pagesIdx = 2;
    const pageIdx = 3;
    const font1Idx = 4;
    const font2Idx = 5;
    const contentsIdx = 6;

    const objects = [];
    objects[catalogIdx] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;
    objects[pagesIdx] = `<< /Type /Pages /Kids [${pageIdx} 0 R] /Count 1 >>`;
    objects[pageIdx] = `<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 595 842] /Contents ${contentsIdx} 0 R /Resources << /Font << /F1 ${font1Idx} 0 R /F2 ${font2Idx} 0 R >> >> >>`;
    objects[font1Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    objects[font2Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

    const streamLength = Buffer.byteLength(stream, 'utf-8');
    objects[contentsIdx] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`;

    const buffers = [];
    buffers.push(Buffer.from(header + '\n', 'utf-8'));

    let offsetCounter = header.length + 1; // Including new line character
    const offsets = [];

    for (let i = 1; i <= 6; i++) {
      offsets[i] = offsetCounter;
      const objHeader = `${i} 0 obj\n`;
      const objBody = objects[i] + '\nendobj\n';
      const objBuffer = Buffer.from(objHeader + objBody, 'utf-8');
      buffers.push(objBuffer);
      offsetCounter += objBuffer.length;
    }

    const xrefOffset = offsetCounter;
    
    // Add Cross Reference Table (xref)
    buffers.push(Buffer.from('xref\n0 7\n0000000000 65535 f \n', 'utf-8'));
    for (let i = 1; i <= 6; i++) {
      const offsetStr = offsets[i].toString().padStart(10, '0');
      buffers.push(Buffer.from(`${offsetStr} 00000 n \n`, 'utf-8'));
    }

    // Add Trailer & startxref offset
    buffers.push(Buffer.from(`trailer\n<< /Size 7 /Root ${catalogIdx} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'utf-8'));

    return Buffer.concat(buffers);
  }
}

module.exports = SimplePdfGenerator;
