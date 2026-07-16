const crypto = require('crypto');

/**
 * Pure Node.js PDF compilation engine.
 * Supports multi-page flow layout, negative values formatting, special Unicode names, 
 * page overflow limits, layout grids, and catalog index calculations.
 */
class SimplePdfGenerator {
  /**
   * Generates a Maroon-themed PDF Commission Report
   */
  static generateCommissionPdf(record, searcherUsername, ipAddress) {
    const companyConfig = require('../config/company');
    return this.buildPdf({
      title: `${companyConfig.companyName.toUpperCase()} COMMISSION REPORT`,
      themeColor: companyConfig.companyColor || '0.5 0 0',
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
    const companyConfig = require('../config/company');
    return this.buildPdf({
      title: `${companyConfig.companyName.toUpperCase()} DEDUCTION DETAILS`,
      themeColor: '0.77 0.63 0.35', // Gold in RGB decimal (197, 160, 89)
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
    // Generate unique reference number matching the specifications
    const refNum = `REF-${record.batch_id.substring(0, 8).toUpperCase()}-${crypto.createHash('sha256').update(record.ic_number).digest('hex').substring(0, 8).toUpperCase()}`;
    const publishDate = record.published_at ? new Date(record.published_at).toLocaleDateString() : 'N/A';
    const genTime = new Date().toLocaleString();

    // Multi-page streaming variables
    let currentStream = '';
    let currentPage = 1;
    const pageStreams = [];

    // Helper function to build page headers
    const writeHeader = (pageNumber) => {
      let header = '';
      
      // Mawar Teraju stylized vector rose and green leaf
      header += `q\n`;
      header += `0.15 0.55 0.15 rg\n`; // green leaf
      header += `12 0 0 12 48 775 cm\n`;
      header += `0.5 0 m 0.8 0.5 l 0.5 1 l 0.2 0.5 l f\n`;
      header += `Q\n`;
      header += `q\n`;
      header += `${themeColor} rg\n`; // rose petals (maroon or gold depending on type)
      header += `10 0 0 10 52 780 cm\n`;
      header += `0.5 0 m 0.9 0.2 l 1 0.6 l 0.7 0.9 l 0.3 0.9 l 0 0.6 l 0.1 0.2 l f\n`;
      header += `Q\n`;

      // Title & Reference
      header += `BT\n/F2 14 Tf\n50 755 Td\n(${title}) Tj\nET\n`;
      header += `BT\n/F1 8 Tf\n50 740 Td\n(Rujukan: ${refNum} | Halaman: ${pageNumber}) Tj\nET\n`;

      // Horizontal Divider
      header += `0.5 w\n50 730 m\n545 730 l\nS\n`;

      // Period Details
      header += `BT\n/F2 9 Tf\n50 715 Td\n(Batch / Period:) Tj\nET\n`;
      header += `BT\n/F1 9 Tf\n120 715 Td\n(${record.batch_name}) Tj\nET\n`;
      header += `BT\n/F2 9 Tf\n280 715 Td\n(Batch Version:) Tj\nET\n`;
      header += `BT\n/F1 9 Tf\n350 715 Td\n(v${record.version || 1}) Tj\nET\n`;
      header += `BT\n/F2 9 Tf\n425 715 Td\n(Published:) Tj\nET\n`;
      header += `BT\n/F1 9 Tf\n475 715 Td\n(${publishDate}) Tj\nET\n`;

      // Dispatcher Profile
      header += `BT\n/F2 9 Tf\n50 695 Td\n(Dispatcher ID:) Tj\nET\n`;
      header += `BT\n/F1 9 Tf\n120 695 Td\n(${record.dispatcher_id}) Tj\nET\n`;
      header += `BT\n/F2 9 Tf\n280 695 Td\n(NRIC / IC Number:) Tj\nET\n`;
      header += `BT\n/F1 9 Tf\n370 695 Td\n(${record.ic_number}) Tj\nET\n`;
      
      header += `BT\n/F2 9 Tf\n50 680 Td\n(Name:) Tj\nET\n`;
      // Escape parentheses in string name to avoid PDF syntax breaks
      const escapedName = record.name.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      header += `BT\n/F1 9 Tf\n120 680 Td\n(${escapedName}) Tj\nET\n`;

      // Horizontal separator
      header += `0.5 w\n50 670 m\n545 670 l\nS\n`;

      // Table Header Block
      header += `q\n0.95 0.95 0.95 rg\n50 645 495 18 re\nf\nQ\n`;
      header += `BT\n/F2 9 Tf\n60 651 Td\n(Butiran Ringkasan Kewangan) Tj\nET\n`;

      return header;
    };

    // Initialize Page 1
    currentStream += writeHeader(currentPage);
    let y = 620;

    const addRow = (label, val, isCurrency = true) => {
      // If content height overflows, push current and initialize a new page
      if (y < 300) {
        currentStream += `0.5 w\n50 ${y + 5} m\n545 ${y + 5} l\nS\n`;
        currentStream += `BT\n/F1 8 Tf\n50 ${y - 12} Td\n(Penjana: ${searcherUsername} | IP: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
        currentStream += `BT\n/F1 8 Tf\n420 ${y - 12} Td\n(Dokumen cetakan komputer - Halaman ${currentPage}) Tj\nET\n`;
        
        pageStreams.push(currentStream);
        
        currentPage++;
        currentStream = writeHeader(currentPage);
        y = 620;
      }

      // Format value appropriately
      let formattedVal;
      if (isCurrency) {
        const cleanVal = parseFloat(val || 0).toFixed(2);
        formattedVal = `RM ${cleanVal}`;
      } else {
        formattedVal = Math.round(parseFloat(val || 0)).toString();
      }

      currentStream += `BT\n/F1 9 Tf\n60 ${y} Td\n(${label}) Tj\nET\nBT\n/F1 9 Tf\n480 ${y} Td\n(${formattedVal}) Tj\nET\n`;
      y -= 18;
    };

    // 1. Process rows dynamically depending on report type
    if (type === 'commission') {
      addRow('Parcel Quantity', record.parcel_qty, false);
      addRow('Net Parcel Deliveries', record.net_parcel, false);
      addRow('Exclude Extra Weight Yoyi', record.exclude_extra_weight_yoyi, false);
      addRow('RM1.11 Commission Rate', record.commission_rate);
      addRow('New Joiner Diff Rate', record.diff_rate_new_joiner);
      addRow('Count of Pickup', record.count_pickup, false);
      addRow('Extra Weight Commission', record.extra_weight_commission);
      addRow('Total Gross Commission', record.total_commission);
      addRow('Pickup Allowance Additions', record.addition_pickup_commission);
      addRow('Refund Penalty Additions', record.addition_refund_penalty);
      addRow('Others Additions', record.addition_others);
      addRow('Sorter Allowance Additions', record.addition_sorter);
      addRow('Deduction: Advance', record.deduction_advance);
      addRow('Deduction: Pending COD', record.deduction_pending_cod);
      addRow('Deduction: HQ Penalty', record.deduction_hq_penalty);
      addRow('Deduction: DuitNow Penalty', record.deduction_duitnow_penalty);
      addRow('Deduction: Late COD Penalty', record.deduction_late_cod_penalty);
      addRow('Deduction: Lost Individual', record.deduction_lost_individual);
      addRow('Deduction: Lost Parcel Hub', record.deduction_lost_parcel_hub);
      addRow('Nett Commission', record.nett_commission);
      addRow('Final Net Amount to Pay', record.final_amount_to_pay);
    } else {
      addRow('DEDUCTION: ADVANCE (Duit Muka)', record.deduction_advance);
      addRow('DEDUCTION: PENDING COD (Tunggakan COD)', record.deduction_pending_cod);
      addRow('DEDUCTION: HQ PENALTY (Denda HQ)', record.deduction_hq_penalty);
      addRow('DEDUCTION: DUITNOW PENALTY', record.deduction_duitnow_penalty);
      addRow('DEDUCTION: LATE COD PENALTY', record.deduction_late_cod_penalty);
      addRow('DEDUCTION: LOST INDIVIDUAL (Barang Hilang Individu)', record.deduction_lost_individual);
      addRow('DEDUCTION: LOST PARCEL HUB (Barang Hilang Hub)', record.deduction_lost_parcel_hub);
      
      const totalDeds = parseFloat(record.deduction_advance || 0) +
                        parseFloat(record.deduction_pending_cod || 0) +
                        parseFloat(record.deduction_hq_penalty || 0) +
                        parseFloat(record.deduction_duitnow_penalty || 0) +
                        parseFloat(record.deduction_late_cod_penalty || 0) +
                        parseFloat(record.deduction_lost_individual || 0) +
                        parseFloat(record.deduction_lost_parcel_hub || 0);
      addRow('TOTAL DEDUCTIONS (Jumlah Potongan)', totalDeds);
    }

    // Write footer on the final page
    const companyConfig = require('../config/company');
    currentStream += `0.5 w\n50 ${y + 5} m\n545 ${y + 5} l\nS\n`;
    currentStream += `BT\n/F1 8 Tf\n50 ${y - 12} Td\n(Penjana: ${searcherUsername} | IP Address: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
    currentStream += `BT\n/F1 8 Tf\n420 ${y - 12} Td\n(${companyConfig.portalName} - Halaman ${currentPage} / ${currentPage}) Tj\nET\n`;
    pageStreams.push(currentStream);

    const N = pageStreams.length;
    const headerStr = '%PDF-1.4';
    const catalogIdx = 1;
    const pagesIdx = 2;
    const font1Idx = 3;
    const font2Idx = 4;

    const objects = [];
    objects[catalogIdx] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;
    
    // Pages kids definition list
    const kidsList = Array.from({ length: N }, (_, i) => `${5 + i * 2} 0 R`).join(' ');
    objects[pagesIdx] = `<< /Type /Pages /Kids [${kidsList}] /Count ${N} >>`;
    
    objects[font1Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    objects[font2Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

    // Add page contents objects dynamically
    for (let i = 1; i <= N; i++) {
      const pageObjIdx = 5 + (i - 1) * 2;
      const contentObjIdx = 6 + (i - 1) * 2;
      
      objects[pageObjIdx] = `<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 595 842] /Contents ${contentObjIdx} 0 R /Resources << /Font << /F1 ${font1Idx} 0 R /F2 ${font2Idx} 0 R >> >> >>`;
      
      const contentStream = pageStreams[i - 1];
      const streamLength = Buffer.byteLength(contentStream, 'utf-8');
      objects[contentObjIdx] = `<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`;
    }

    const buffers = [];
    buffers.push(Buffer.from(headerStr + '\n', 'utf-8'));

    let offsetCounter = headerStr.length + 1;
    const offsets = [];
    const totalObjectsCount = 4 + N * 2;

    for (let i = 1; i <= totalObjectsCount; i++) {
      offsets[i] = offsetCounter;
      const objHeader = `${i} 0 obj\n`;
      const objBody = objects[i] + '\nendobj\n';
      const objBuffer = Buffer.from(objHeader + objBody, 'utf-8');
      buffers.push(objBuffer);
      offsetCounter += objBuffer.length;
    }

    const xrefOffset = offsetCounter;
    
    // Write cross-reference table (xref)
    buffers.push(Buffer.from(`xref\n0 ${totalObjectsCount + 1}\n0000000000 65535 f \n`, 'utf-8'));
    for (let i = 1; i <= totalObjectsCount; i++) {
      const offsetStr = offsets[i].toString().padStart(10, '0');
      buffers.push(Buffer.from(`${offsetStr} 00000 n \n`, 'utf-8'));
    }

    // Write PDF trailer
    buffers.push(Buffer.from(`trailer\n<< /Size ${totalObjectsCount + 1} /Root ${catalogIdx} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'utf-8'));

    return Buffer.concat(buffers);
  }
}

module.exports = SimplePdfGenerator;
