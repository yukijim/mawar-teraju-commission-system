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
   * Generates a Maroon-themed PDF Deduction Details Report
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
   * Generates a Maroon-themed Combined PDF Commission & Deduction Report
   */
  static generateCombinedPdf(record, searcherUsername, ipAddress) {
    const companyConfig = require('../config/company');
    return this.buildPdf({
      title: `${companyConfig.companyName.toUpperCase()} COMMISSION REPORT`,
      themeColor: companyConfig.companyColor || '0.5 0 0',
      record,
      searcherUsername,
      ipAddress,
      type: 'combined'
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

    // Load logo image
    const fs = require('fs');
    const path = require('path');
    let logoBuffer = null;
    try {
      const logoPath = path.join(__dirname, '../../../assets/images/branding/logo_mawar_teraju.jpg');
      if (fs.existsSync(logoPath)) {
        logoBuffer = fs.readFileSync(logoPath);
      }
    } catch (e) {
      console.error('Error loading logo image:', e);
    }

    const dateSource = record.published_at ? new Date(record.published_at) : new Date();
    const formattedMonth = (record.month !== undefined && record.month !== null) ? record.month.toString().padStart(2, '0') : (dateSource.getMonth() + 1).toString().padStart(2, '0');
    const formattedYear = (record.year !== undefined && record.year !== null) ? record.year.toString() : dateSource.getFullYear().toString();

    // Format helpers
    const formatCurrency = (val) => {
      const cleanVal = parseFloat(val || 0).toFixed(2);
      return `RM ${cleanVal}`;
    };
    const formatInteger = (val) => {
      return Math.round(parseFloat(val || 0)).toString();
    };

    let pageStreams = [];
    let currentStream = '';
    let currentPage = 1;

    if (type === 'combined') {
      // 1. Payslip style layout for combined report
      let header = '';
      
      // Draw real logo image or fallback vector rose
      if (logoBuffer) {
        header += `q\n`;
        header += `63 0 0 45 40 765 cm\n`;
        header += `/I1 Do\n`;
        header += `Q\n`;

        header += `BT\n/F2 12 Tf\n115 788 Td\n(MAWAR TERAJU SDN BHD) Tj\nET\n`;
        header += `BT\n/F1 9.5 Tf\n115 773 Td\n(Monthly Income Report: ${formattedMonth}/${formattedYear}) Tj\nET\n`;
      } else {
        header += `q\n`;
        header += `0.15 0.55 0.15 rg\n`;
        header += `12 0 0 12 48 775 cm\n`;
        header += `0.5 0 m 0.8 0.5 l 0.5 1 l 0.2 0.5 l f\n`;
        header += `Q\n`;
        header += `q\n`;
        header += `${themeColor} rg\n`;
        header += `10 0 0 10 52 780 cm\n`;
        header += `0.5 0 m 0.9 0.2 l 1 0.6 l 0.7 0.9 l 0.3 0.9 l 0 0.6 l 0.1 0.2 l f\n`;
        header += `Q\n`;
        header += `BT\n/F2 14 Tf\n50 755 Td\n(${title}) Tj\nET\n`;
        header += `BT\n/F1 8 Tf\n50 740 Td\n(Rujukan: ${refNum} | Halaman: 1) Tj\nET\n`;
      }

      // Horizontal Divider under header
      header += `0.5 w\n40 748 m\n555 748 l\nS\n`;

      // Dispatcher Profile Box (Payslip style)
      header += `q\n0.98 0.98 0.98 rg\n0.5 w\n40 680 515 55 re\nb\nQ\n`;
      
      const escapedName = record.name.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      header += `BT\n/F2 8.5 Tf\n50 718 Td\n(Name:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n110 718 Td\n(${escapedName}) Tj\nET\n`;
      header += `BT\n/F2 8.5 Tf\n330 718 Td\n(Code/Dispatcher ID:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n430 718 Td\n(${record.dispatcher_id}) Tj\nET\n`;

      header += `BT\n/F2 8.5 Tf\n50 702 Td\n(IC/Passport:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n110 702 Td\n(${record.ic_number}) Tj\nET\n`;
      header += `BT\n/F2 8.5 Tf\n330 702 Td\n(Batch/Period:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n430 702 Td\n(${record.batch_name}) Tj\nET\n`;

      header += `BT\n/F2 8.5 Tf\n50 686 Td\n(Rujukan:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n110 686 Td\n(${refNum}) Tj\nET\n`;
      header += `BT\n/F2 8.5 Tf\n330 686 Td\n(Published Date:) Tj\nET\n`;
      header += `BT\n/F1 8.5 Tf\n430 686 Td\n(${publishDate}) Tj\nET\n`;

      currentStream += header;

      // Table Header Block
      currentStream += `q\n0.93 0.93 0.93 rg\n40 645 515 20 re\nf\nQ\n`;
      currentStream += `BT\n/F2 9.5 Tf\n50 651 Td\n(Addition) Tj\nET\n`;
      currentStream += `BT\n/F2 9.5 Tf\n307 651 Td\n(Deduction) Tj\nET\n`;

      // Columns box and divider lines
      currentStream += `0.5 w\n40 300 515 345 re\nS\n`;
      currentStream += `0.5 w\n297 300 m\n297 645 l\nS\n`;

      // Items list
      const additions = [
        { label: `Parcel Commission (Qty: ${record.parcel_qty})`, val: record.commission_rate },
        { label: 'Extra Weight Commission', val: record.extra_weight_commission },
        { label: 'ADD: REFUND PENALTY', val: record.addition_refund_penalty },
        { label: 'ADD: PICKUP COMMISSION', val: record.addition_pickup_commission },
        { label: 'ADD: OTHERS', val: record.addition_others },
        { label: 'ADD: SORTER', val: record.addition_sorter },
        { label: 'EXTRA REWARD', val: record.addition_extra_reward }
      ];

      const deductions = [
        { label: 'DEDUCTION: ADVANCE', val: record.deduction_advance },
        { label: 'DEDUCTION: PENDING COD', val: record.deduction_pending_cod },
        { label: 'DEDUCTION: HQ PENALTY', val: record.deduction_hq_penalty },
        { label: 'DEDUCTION: DUITNOW PENALTY', val: record.deduction_duitnow_penalty },
        { label: 'DEDUCTION: LATE COD PENALTY', val: record.deduction_late_cod_penalty },
        { label: 'DEDUCTION: LOST INDIVIDUAL', val: record.deduction_lost_individual },
        { label: 'DEDUCTION: LOST PARCEL HUB', val: record.deduction_lost_parcel_hub }
      ];

      for (let i = 0; i < 7; i++) {
        const yRow = 615 - i * 22;
        
        // Addition
        currentStream += `BT\n/F1 8.5 Tf\n50 ${yRow} Td\n(${additions[i].label}) Tj\nET\n`;
        currentStream += `BT\n/F1 8.5 Tf\n210 ${yRow} Td\n(${formatCurrency(additions[i].val)}) Tj\nET\n`;

        // Deduction
        currentStream += `BT\n/F1 8.5 Tf\n307 ${yRow} Td\n(${deductions[i].label}) Tj\nET\n`;
        currentStream += `BT\n/F1 8.5 Tf\n465 ${yRow} Td\n(${formatCurrency(deductions[i].val)}) Tj\nET\n`;
      }

      // Calculations for Bottom Summary
      const totalDeduction = deductions.reduce((sum, item) => sum + parseFloat(item.val || 0), 0);
      const totalNetPay = parseFloat(record.nett_commission || 0);
      const totalAddition = totalNetPay + totalDeduction;

      // Bottom summary box (Total Addition, Total Deduction)
      currentStream += `q\n0.97 0.97 0.97 rg\n0.5 w\n40 255 515 30 re\nb\nQ\n`;
      currentStream += `0.5 w\n297 255 m\n297 285 l\nS\n`;
      
      currentStream += `BT\n/F2 9 Tf\n50 266 Td\n(Total Addition:) Tj\nET\n`;
      currentStream += `BT\n/F2 9 Tf\n210 266 Td\n(${formatCurrency(totalAddition)}) Tj\nET\n`;

      currentStream += `BT\n/F2 9 Tf\n307 266 Td\n(Total Deduction:) Tj\nET\n`;
      currentStream += `BT\n/F2 9 Tf\n465 266 Td\n(${formatCurrency(totalDeduction)}) Tj\nET\n`;

      // Total Net Pay box
      currentStream += `q\n0.92 0.96 0.92 rg\n0.5 w\n40 215 515 30 re\nb\nQ\n`;
      currentStream += `BT\n/F2 10.5 Tf\n307 225 Td\n(Total Net Income :) Tj\nET\n`;
      currentStream += `BT\n/F2 10.5 Tf\n465 225 Td\n(${formatCurrency(totalNetPay)}) Tj\nET\n`;

      // Final signature/meta footer
      const companyConfig = require('../config/company');
      currentStream += `0.5 w\n40 100 m\n555 100 l\nS\n`;
      currentStream += `BT\n/F1 8 Tf\n40 85 Td\n(Penjana: ${searcherUsername} | IP Address: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
      currentStream += `BT\n/F1 8 Tf\n420 85 Td\n(${companyConfig.portalName} - Halaman 1 / 1) Tj\nET\n`;

      pageStreams.push(currentStream);

    } else {
      // 2. Original style table format for commission or deduction only reports
      // Helper function to build page headers
      const writeHeader = (pageNumber) => {
        let header = '';
        
        if (logoBuffer) {
          header += `q\n`;
          header += `63 0 0 45 40 765 cm\n`;
          header += `/I1 Do\n`;
          header += `Q\n`;

          header += `BT\n/F2 12 Tf\n115 788 Td\n(MAWAR TERAJU SDN BHD) Tj\nET\n`;
          header += `BT\n/F1 9.5 Tf\n115 773 Td\n(Monthly Income Report: ${formattedMonth}/${formattedYear}) Tj\nET\n`;
        } else {
          header += `q\n`;
          header += `0.15 0.55 0.15 rg\n`;
          header += `12 0 0 12 48 775 cm\n`;
          header += `0.5 0 m 0.8 0.5 l 0.5 1 l 0.2 0.5 l f\n`;
          header += `Q\n`;
          header += `q\n`;
          header += `${themeColor} rg\n`;
          header += `10 0 0 10 52 780 cm\n`;
          header += `0.5 0 m 0.9 0.2 l 1 0.6 l 0.7 0.9 l 0.3 0.9 l 0 0.6 l 0.1 0.2 l f\n`;
          header += `Q\n`;
          header += `BT\n/F2 14 Tf\n50 755 Td\n(${title}) Tj\nET\n`;
          header += `BT\n/F1 8 Tf\n50 740 Td\n(Rujukan: ${refNum} | Halaman: ${pageNumber}) Tj\nET\n`;
        }

        // Horizontal Divider
        header += `0.5 w\n40 748 m\n555 748 l\nS\n`;

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
        const escapedName = record.name.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        header += `BT\n/F1 9 Tf\n120 680 Td\n(${escapedName}) Tj\nET\n`;

        // Horizontal separator
        header += `0.5 w\n50 670 m\n545 670 l\nS\n`;

        // Table Header Block
        header += `q\n0.95 0.95 0.95 rg\n50 645 495 18 re\nf\nQ\n`;
        header += `BT\n/F2 9 Tf\n60 651 Td\n(Butiran Ringkasan Kewangan) Tj\nET\n`;

        return header;
      };

      currentStream += writeHeader(currentPage);
      let y = 620;

      const addRow = (label, val, formatType = 'currency') => {
        if (y < 120) {
          currentStream += `0.5 w\n50 ${y + 5} m\n545 ${y + 5} l\nS\n`;
          currentStream += `BT\n/F1 8 Tf\n50 ${y - 12} Td\n(Penjana: ${searcherUsername} | IP: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
          currentStream += `BT\n/F1 8 Tf\n420 ${y - 12} Td\n(Dokumen cetakan komputer - Halaman ${currentPage}) Tj\nET\n`;
          
          pageStreams.push(currentStream);
          
          currentPage++;
          currentStream = writeHeader(currentPage);
          y = 620;
        }

        let formattedVal;
        if (formatType === 'currency') {
          formattedVal = formatCurrency(val);
        } else if (formatType === 'integer') {
          formattedVal = formatInteger(val);
        } else {
          formattedVal = (val || '').toString();
        }

        currentStream += `BT\n/F1 9 Tf\n60 ${y} Td\n(${label}) Tj\nET\nBT\n/F1 9 Tf\n480 ${y} Td\n(${formattedVal}) Tj\nET\n`;
        y -= 18;
      };

      if (type === 'commission') {
        addRow('Parcel Quantity', record.parcel_qty, 'integer');
        addRow('Parcel Commission', record.commission_rate, 'currency');
        addRow('Extra Weight Commission', record.extra_weight_commission, 'currency');
        addRow('Total Commission', record.total_commission, 'currency');
        addRow('ADD: REFUND PENALTY', record.addition_refund_penalty, 'currency');
        addRow('ADD: PICKUP COMMISSION', record.addition_pickup_commission, 'currency');
        addRow('ADD: OTHERS', record.addition_others, 'currency');
        addRow('ADD: SORTER', record.addition_sorter, 'currency');
        addRow('EXTRA REWARD', record.addition_extra_reward, 'currency');
        addRow('NETT COMMISSION', record.nett_commission, 'currency');
      } else if (type === 'deduction') {
        addRow('DEDUCTION: ADVANCE', record.deduction_advance, 'currency');
        addRow('DEDUCTION: PENDING COD', record.deduction_pending_cod, 'currency');
        addRow('DEDUCTION: HQ PENALTY', record.deduction_hq_penalty, 'currency');
        addRow('DEDUCTION: DUITNOW PENALTY', record.deduction_duitnow_penalty, 'currency');
        addRow('DEDUCTION: LATE COD PENALTY', record.deduction_late_cod_penalty, 'currency');
        addRow('DEDUCTION: LOST INDIVIDUAL', record.deduction_lost_individual, 'currency');
        addRow('DEDUCTION: LOST PARCEL HUB', record.deduction_lost_parcel_hub, 'currency');
      }

      const companyConfig = require('../config/company');
      currentStream += `0.5 w\n50 ${y + 5} m\n545 ${y + 5} l\nS\n`;
      currentStream += `BT\n/F1 8 Tf\n50 ${y - 12} Td\n(Penjana: ${searcherUsername} | IP Address: ${ipAddress} | Tarikh Cetak: ${genTime}) Tj\nET\n`;
      currentStream += `BT\n/F1 8 Tf\n420 ${y - 12} Td\n(${companyConfig.portalName} - Halaman ${currentPage} / ${currentPage}) Tj\nET\n`;
      pageStreams.push(currentStream);
    }

    const N = pageStreams.length;
    const headerStr = '%PDF-1.4';
    const catalogIdx = 1;
    const pagesIdx = 2;
    const font1Idx = 3;
    const font2Idx = 4;
    const logoIdx = 5;

    const objects = [];
    objects[catalogIdx] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;
    
    let startPageIdx = 5;
    let totalObjectsCount = 4 + N * 2;
    let hasLogo = false;

    if (logoBuffer) {
      hasLogo = true;
      startPageIdx = 6;
      totalObjectsCount = 5 + N * 2;
      
      const imgHeader = `<< /Type /XObject /Subtype /Image /Width 174 /Height 124 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBuffer.length} >>\nstream\n`;
      const imgFooter = `\nendstream`;
      objects[logoIdx] = Buffer.concat([
        Buffer.from(imgHeader, 'utf-8'),
        logoBuffer,
        Buffer.from(imgFooter, 'utf-8')
      ]);
    }

    const kidsList = Array.from({ length: N }, (_, i) => `${startPageIdx + i * 2} 0 R`).join(' ');
    objects[pagesIdx] = `<< /Type /Pages /Kids [${kidsList}] /Count ${N} >>`;
    
    objects[font1Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    objects[font2Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

    // Add page contents objects dynamically
    for (let i = 1; i <= N; i++) {
      const pageObjIdx = startPageIdx + (i - 1) * 2;
      const contentObjIdx = pageObjIdx + 1;
      
      let resources = `<< /Font << /F1 ${font1Idx} 0 R /F2 ${font2Idx} 0 R >>`;
      if (hasLogo) {
        resources += ` /XObject << /I1 ${logoIdx} 0 R >>`;
      }
      resources += ` >>`;

      objects[pageObjIdx] = `<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 595 842] /Contents ${contentObjIdx} 0 R /Resources ${resources} >>`;
      
      const contentStream = pageStreams[i - 1];
      const streamLength = Buffer.byteLength(contentStream, 'utf-8');
      objects[contentObjIdx] = `<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`;
    }

    const buffers = [];
    buffers.push(Buffer.from(headerStr + '\n', 'utf-8'));

    let offsetCounter = headerStr.length + 1;
    const offsets = [];

    for (let i = 1; i <= totalObjectsCount; i++) {
      offsets[i] = offsetCounter;
      const objHeader = Buffer.from(`${i} 0 obj\n`, 'utf-8');
      const objBody = Buffer.isBuffer(objects[i]) ? objects[i] : Buffer.from(objects[i], 'utf-8');
      const objFooter = Buffer.from('\nendobj\n', 'utf-8');
      
      const objBuffer = Buffer.concat([objHeader, objBody, objFooter]);
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
