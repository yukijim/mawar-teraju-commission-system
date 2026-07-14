/**
 * dispatch.js - Dispatcher Search & Display Module (Batch Support)
 * Handles NRIC input formatting, database search queries, and rendering
 * detailed commission/deduction records with PDF export capabilities.
 */

const Dispatch = {
    isFormatterBound: false,
    
    // Store current record in memory for PDF downloads
    currentSearchedRecord: null,

    /**
     * Attaches an auto-formatter to the NRIC input field exactly once.
     */
    bindIcFormatter() {
        if (this.isFormatterBound) return;

        const input = window.DomCache.get('dispatch-ic-input');
        if (!input) return;

        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9]/g, '');
            let formatted = '';
            
            if (val.length > 0) {
                formatted += val.substring(0, 6);
            }
            if (val.length > 6) {
                formatted += '-' + val.substring(6, 8);
            }
            if (val.length > 8) {
                formatted += '-' + val.substring(8, 12);
            }
            e.target.value = formatted;
        });

        this.isFormatterBound = true;
    },

    /**
     * Resets search inputs and hides results and empty state containers.
     */
    resetSearch() {
        const input = window.DomCache.get('dispatch-ic-input');
        if (input) input.value = '';

        const resultsArea = window.DomCache.get('search-results-area');
        const emptyArea = window.DomCache.get('search-empty-area');

        if (resultsArea) resultsArea.style.display = 'none';
        if (emptyArea) emptyArea.style.display = 'none';
        this.currentSearchedRecord = null;
    },

    /**
     * Executes the commission search against the database.
     * @param {Event} event - Submit event from the search form
     * @returns {Promise<void>}
     */
    async handleSearch(event) {
        event.preventDefault();
        
        const input = window.DomCache.get('dispatch-ic-input');
        if (!input || !window.DB) return;

        const rawIc = input.value;
        const cleanIc = rawIc.replace(/[^0-9]/g, '');

        if (cleanIc.length < 5) {
            App.showToast('Format IC Salah', 'Sila masukkan nombor IC yang sah.', 'warning');
            return;
        }

        const startTime = performance.now();
        
        try {
            const records = await window.DB.searchByIc(cleanIc);
            const endTime = performance.now();
            const latency = (endTime - startTime).toFixed(2);

            const resultsArea = window.DomCache.get('search-results-area');
            const emptyArea = window.DomCache.get('search-empty-area');
            const selectionArea = document.getElementById('search-selection-area');

            if (records.length === 0) {
                if (resultsArea) resultsArea.style.display = 'none';
                if (selectionArea) selectionArea.style.display = 'none';
                
                const searchedIcEl = window.DomCache.get('searched-ic-number');
                if (searchedIcEl) searchedIcEl.textContent = rawIc;
                
                if (emptyArea) emptyArea.style.display = 'block';
                this.currentSearchedRecord = null;

                await window.DB.log('Carian IC (Gagal)', `Carian dilakukan bagi IC ${rawIc}. Tiada rekod dijumpai. (Tempoh: ${latency}ms)`, 'Dispatch');
            } else {
                if (emptyArea) emptyArea.style.display = 'none';
                if (resultsArea) resultsArea.style.display = 'block';

                // Group records by unique dispatcher_id
                const recordsById = {};
                records.forEach(r => {
                    const id = r.dispatcher_id || 'N/A';
                    if (!recordsById[id]) {
                        recordsById[id] = [];
                    }
                    recordsById[id].push(r);
                });

                const uniqueIds = Object.keys(recordsById);

                if (uniqueIds.length > 1) {
                    // Step 1: Prompt to select Dispatcher ID
                    this.showDispatcherIdSelection(uniqueIds, recordsById, rawIc, latency);
                } else {
                    // Only 1 Dispatcher ID, proceed to check periods
                    const dispatcherId = uniqueIds[0];
                    const dispatcherRecords = recordsById[dispatcherId];
                    this.processDispatcherRecords(dispatcherId, dispatcherRecords, rawIc, latency);
                }
            }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Search');
        }
    },

    showDispatcherIdSelection(uniqueIds, recordsById, rawIc, latency) {
        const selectionArea = document.getElementById('search-selection-area');
        const summaryCard = document.getElementById('result-summary-card');
        const printButtons = document.getElementById('result-pdf-buttons');
        const detailsContainer = window.DomCache.get('search-details-container');
        const detailsTitle = document.getElementById('result-detail-title');

        // Hide actual result details while selecting
        if (summaryCard) summaryCard.style.display = 'none';
        if (printButtons) printButtons.style.display = 'none';
        if (detailsTitle) detailsTitle.style.display = 'none';
        if (detailsContainer) detailsContainer.style.display = 'none';

        selectionArea.style.display = 'block';
        selectionArea.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--info); padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.05);">
                <h4 style="margin-bottom: 0.5rem; color: var(--info); display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="user-check"></i> Sila Pilih Profil Dispatcher
                </h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">No. IC ini mempunyai lebih daripada satu Profil/Dispatcher ID:</p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${uniqueIds.map(id => {
                        const name = recordsById[id][0].name || recordsById[id][0].nama || 'N/A';
                        return `
                            <button class="btn btn-secondary" style="text-align: left; justify-content: flex-start; padding: 0.75rem 1rem; width: 100%; border: 1px solid rgba(255, 255, 255, 0.1);" onclick="Dispatch.selectDispatcherId('${id}')">
                                <i data-lucide="user" style="margin-right: 0.5rem; color: var(--primary);"></i> 
                                <strong style="color: var(--primary); margin-right: 0.5rem;">${id}</strong> - ${name}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        window.UI.renderIcons();

        // Save records and context in temp state
        this.tempRecordsById = recordsById;
        this.tempRawIc = rawIc;
        this.tempLatency = latency;
    },

    selectDispatcherId(id) {
        const records = this.tempRecordsById[id];
        this.processDispatcherRecords(id, records, this.tempRawIc, this.tempLatency);
    },

    processDispatcherRecords(dispatcherId, records, rawIc, latency) {
        const selectionArea = document.getElementById('search-selection-area');
        
        // Group by period/batch
        if (records.length > 1) {
            // Prompt to select period/batch
            const summaryCard = document.getElementById('result-summary-card');
            const printButtons = document.getElementById('result-pdf-buttons');
            const detailsContainer = window.DomCache.get('search-details-container');
            const detailsTitle = document.getElementById('result-detail-title');

            if (summaryCard) summaryCard.style.display = 'none';
            if (printButtons) printButtons.style.display = 'none';
            if (detailsTitle) detailsTitle.style.display = 'none';
            if (detailsContainer) detailsContainer.style.display = 'none';

            selectionArea.style.display = 'block';
            selectionArea.innerHTML = `
                <div class="card" style="border-left: 4px solid var(--info); padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.05);">
                    <h4 style="margin-bottom: 0.5rem; color: var(--info); display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="calendar"></i> Sila Pilih Tempoh Laporan
                    </h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Profil <strong>${dispatcherId}</strong> mempunyai rekod bagi tempoh berikut:</p>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${records.map((rec, idx) => {
                            const batchName = rec.batch_name || rec.batchName || `Batch ID ${rec.batch_id || rec.batchId}`;
                            return `
                                <button class="btn btn-secondary" style="text-align: left; justify-content: flex-start; padding: 0.75rem 1rem; width: 100%; border: 1px solid rgba(255, 255, 255, 0.1);" onclick="Dispatch.selectRecord(${idx})">
                                    <i data-lucide="file-text" style="margin-right: 0.5rem; color: var(--info);"></i> 
                                    <strong style="color: var(--info); margin-right: 0.5rem;">${batchName}</strong> (Bersih: RM ${Number(rec.final_amount_to_pay || rec.nett_commission || 0).toFixed(2)})
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            window.UI.renderIcons();

            this.tempSelectedRecords = records;
            this.tempRawIc = rawIc;
            this.tempLatency = latency;
        } else {
            // Only 1 record, display it directly
            selectionArea.style.display = 'none';
            this.renderFinalRecord(records[0], rawIc, latency);
        }
    },

    selectRecord(idx) {
        const selectionArea = document.getElementById('search-selection-area');
        selectionArea.style.display = 'none';
        this.renderFinalRecord(this.tempSelectedRecords[idx], this.tempRawIc, this.tempLatency);
    },

    renderFinalRecord(record, rawIc, latency) {
        // Restore display of elements
        const summaryCard = document.getElementById('result-summary-card');
        const printButtons = document.getElementById('result-pdf-buttons');
        const detailsContainer = window.DomCache.get('search-details-container');
        const detailsTitle = document.getElementById('result-detail-title');

        if (summaryCard) summaryCard.style.display = 'block';
        if (printButtons) printButtons.style.display = 'flex';
        if (detailsTitle) detailsTitle.style.display = 'flex';
        if (detailsContainer) detailsContainer.style.display = 'flex';

        this.currentSearchedRecord = record;

        // Math calculations for split views
        const grossComm = Number(record.nett_commission || record.total_commission || 0);
        const totalDeds = Number(record.deduction_advance || 0) +
                          Number(record.deduction_pending_cod || 0) +
                          Number(record.deduction_hq_penalty || 0) +
                          Number(record.deduction_duitnow_penalty || 0) +
                          Number(record.deduction_late_cod_penalty || 0) +
                          Number(record.deduction_lost_individual || 0) +
                          Number(record.deduction_lost_parcel_hub || 0);
        const netComm = Number(record.final_amount_to_pay || (grossComm - totalDeds));

        // Populate elements
        const nameEl = window.DomCache.get('result-rider-name');
        const icEl = window.DomCache.get('result-rider-ic');
        const batchEl = document.getElementById('result-batch-name');
        const grossEl = document.getElementById('result-gross-commission');
        const dedEl = document.getElementById('result-total-deductions');
        const netEl = window.DomCache.get('result-total-commission');

        if (nameEl) nameEl.textContent = record.name || record.nama;
        if (icEl) icEl.textContent = rawIc;
        if (batchEl) batchEl.textContent = record.batch_name || record.batchName || 'Legacy / N/A';
        if (grossEl) grossEl.textContent = `RM ${grossComm.toFixed(2)}`;
        if (dedEl) dedEl.textContent = `RM ${totalDeds.toFixed(2)}`;
        if (netEl) netEl.textContent = `RM ${netComm.toFixed(2)}`;

        // Detailed view fields
        if (detailsContainer) {
            detailsContainer.innerHTML = '';

            const displayFields = [
                { key: 'dispatcher_id', label: 'Delivery Dispatcher ID', type: 'string' },
                { key: 'ic_number', label: 'No. IC', type: 'string' },
                { key: 'name', label: 'Delivery Dispatcher Name', type: 'string' },
                { key: 'parcel_qty', label: 'Parcel Quantity', type: 'number' },
                { key: 'net_parcel', label: 'Net Parcel', type: 'number' },
                { key: 'exclude_extra_weight_yoyi', label: 'Exclude Extra Weight YOYI', type: 'number' },
                { key: 'commission_rate', label: 'RM1.11/Parcel Commission', type: 'currency' },
                { key: 'diff_rate_new_joiner', label: 'DIFF RATE NEW JOINER ', type: 'currency' },
                { key: 'count_pickup', label: 'Count of Pick Up Dispatcher Name', type: 'number' },
                { key: 'extra_weight_commission', label: 'Extra Weight Commission (=>5.01kg, Add RM0.10/kg)', type: 'currency' },
                { key: 'total_commission', label: 'Total Commission', type: 'currency' },
                { key: 'deduction_advance', label: 'DEDUCTION: ADVANCE', type: 'currency' },
                { key: 'deduction_pending_cod', label: 'DEDUCTION: PENDING COD', type: 'currency' },
                { key: 'deduction_hq_penalty', label: 'DEDUCTION: HQ PENALTY', type: 'currency' },
                { key: 'deduction_duitnow_penalty', label: 'DEDUCTION: DUITNOW PENALTY', type: 'currency' },
                { key: 'deduction_late_cod_penalty', label: 'DEDUCTION: LATE COD PENALTY', type: 'currency' },
                { key: 'deduction_lost_individual', label: 'DEDUCTION: LOST INDIVIDUAL', type: 'currency' },
                { key: 'deduction_lost_parcel_hub', label: 'DEDUCTION: LOST PARCEL HUB', type: 'currency' },
                { key: 'addition_pickup_commission', label: 'ADD: PICKUP COMMISSION', type: 'currency' },
                { key: 'addition_fuel_allowance', label: 'ADD: FUEL ALLOWANCE', type: 'currency' },
                { key: 'addition_sorter', label: 'ADD: SORTER', type: 'currency' },
                { key: 'nett_commission', label: 'NETT COMMISSION', type: 'currency' },
                { key: 'final_amount_to_pay', label: 'FINAL AMOUNT TO PAY', type: 'currency' },
                { key: 'status_payment', label: 'STATUS', type: 'string' },
                { key: 'date_payment', label: 'DATE PAYMENT', type: 'string' },
                { key: 'remark', label: 'REMARK FARISHA', type: 'string' }
            ];

            const block = document.createElement('div');
            block.className = 'card';
            block.style.background = 'rgba(255, 255, 255, 0.02)';
            block.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            block.style.padding = '1.5rem';

            let detailHeaderHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                    <h4 style="color: var(--info); font-size: 1rem;">Rekod Komisen & Potongan Aktif</h4>
                    <span style="font-weight: 700; color: var(--primary); font-size: 1.1rem; font-family: var(--font-heading);">
                        RM ${netComm.toFixed(2)}
                    </span>
                </div>
            `;

            let fieldsHtml = '';
            displayFields.forEach(field => {
                let val = record[field.key];
                let displayValue = val;

                if (field.type === 'currency') {
                    displayValue = `RM ${Number(val || 0).toFixed(2)}`;
                } else if (field.type === 'number') {
                    displayValue = Number(val || 0).toLocaleString('ms-MY');
                } else if (field.key === 'ic_number' && val) {
                    let raw = val.toString();
                    if (raw.length === 12) {
                        displayValue = `${raw.substring(0, 6)}-${raw.substring(6, 8)}-${raw.substring(8, 12)}`;
                    }
                }

                fieldsHtml += `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.9rem;">
                        <span style="color: var(--text-secondary); text-transform: none;">${field.label}</span>
                        <span style="color: var(--text-primary); font-weight: 600;">${displayValue}</span>
                    </div>
                `;
            });

            block.innerHTML = detailHeaderHtml + fieldsHtml;
            detailsContainer.appendChild(block);
        }

        // Update print timestamp
        const printTimestampEl = document.getElementById('print-timestamp');
        if (printTimestampEl) {
            printTimestampEl.textContent = new Date().toLocaleString('ms-MY');
        }

        window.DB.log('Carian IC (Sukses)', `Carian bagi IC ${rawIc} menjumpai rekod komisen. (Tempoh: ${latency}ms)`, 'Dispatch').catch(() => {});
        if (window.UI) {
            window.UI.renderIcons();
        }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Search');
        }
    },

    /**
     * Downloads Commission Details report as PDF.
     */
    downloadCommissionReportPDF() {
        const record = this.currentSearchedRecord;
        if (!record) {
            App.showToast('Gagal', 'Tiada rekod komisen ditemui untuk dimuat turun.', 'warning');
            return;
        }

        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            App.showToast('Gagal', 'Pustaka jsPDF tidak ditemui. Sila tunggu seketika.', 'danger');
            return;
        }

        try {
            const doc = new window.jspdf.jsPDF();
            const raw = record.ic_number.toString();
            const formattedIc = raw.length === 12 ? `${raw.substring(0, 6)}-${raw.substring(6, 8)}-${raw.substring(8, 12)}` : raw;

            // Brand header
            doc.setFillColor(142, 27, 50); // Maroon background bar
            doc.rect(0, 0, 210, 8, 'F');

            const compName = (window.companyConfig && window.companyConfig.companyName) ? window.companyConfig.companyName.toUpperCase() + ' ENTERPRISE' : 'MAWAR TERAJU ENTERPRISE';
            doc.text(compName, 14, 25);

            doc.setFontSize(10);
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text("Laporan Rasmi Komisen Penghantaran Dispatch", 14, 30);

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(142, 27, 50);
            doc.text("LAPORAN KOMISEN (COMMISSION REPORT)", 14, 42);

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 45, 196, 45);

            // Details metadata table
            doc.autoTable({
                startY: 50,
                head: [['Butiran Dispatcher', 'Maklumat']],
                body: [
                    ["Nama Dispatcher", record.name],
                    ["ID Dispatcher", record.dispatcher_id || 'N/A'],
                    ["No. KP (IC Number)", formattedIc],
                    ["Tempoh Batch Komisen", record.batchName || 'Legacy / N/A'],
                    ["Tarikh Dijana", new Date().toLocaleString('ms-MY')]
                ],
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
            });

            // Commission details table
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(31, 41, 55);
            doc.text("Pecahan Pendapatan & Komisen Kasar:", 14, 98);

            doc.autoTable({
                startY: 102,
                head: [['Parameter Laporan', 'Nilai / Amaun']],
                body: [
                    ["Parcel Quantity (Jumlah Parcel)", record.parcel_qty],
                    ["Net Parcel (Parcel Bersih)", record.net_parcel],
                    ["Exclude Extra Weight YOYI", record.exclude_extra_weight_yoyi],
                    ["RM1.11/Parcel Commission", `RM ${Number(record.commission_rate || 0).toFixed(2)}`],
                    ["DIFF RATE NEW JOINER", `RM ${Number(record.diff_rate_new_joiner || 0).toFixed(2)}`],
                    ["Count of Pick Up Dispatcher Name", record.count_pickup],
                    ["Extra Weight Commission", `RM ${Number(record.extra_weight_commission || 0).toFixed(2)}`],
                    ["Total Commission (Jumlah Kasar)", `RM ${Number(record.total_commission || 0).toFixed(2)}`],
                    ["ADD: PICKUP COMMISSION", `RM ${Number(record.addition_pickup_commission || 0).toFixed(2)}`],
                    ["ADD: FUEL ALLOWANCE", `RM ${Number(record.addition_fuel_allowance || 0).toFixed(2)}`],
                    ["ADD: SORTER", `RM ${Number(record.addition_sorter || 0).toFixed(2)}`],
                    ["NETT COMMISSION", `RM ${Number(record.nett_commission || 0).toFixed(2)}`],
                    ["FINAL AMOUNT TO PAY", `RM ${Number(record.final_amount_to_pay || 0).toFixed(2)}`]
                ],
                theme: 'striped',
                styles: { fontSize: 9.5, cellPadding: 3 },
                headStyles: { fillColor: [142, 27, 50], textColor: 255 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("Dokumen ini dijana secara digital dan dianggap sah tanpa tandatangan.", 14, 285);
                doc.text(`Halaman ${i} daripada ${pageCount}`, 180, 285);
            }

            doc.save(`Laporan_Komisen_${record.name.replace(/\s+/g, '_')}_${(record.batchName || 'Legacy').replace(/\s+/g, '_')}.pdf`);
            App.showToast('Download Berjaya', 'PDF Laporan Komisen berjaya dimuat turun.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'PDF Commission');
        }
    },

    /**
     * Downloads Deduction Details report as PDF.
     */
    downloadDeductionDetailsPDF() {
        const record = this.currentSearchedRecord;
        if (!record) {
            App.showToast('Gagal', 'Tiada rekod potongan ditemui untuk dimuat turun.', 'warning');
            return;
        }

        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            App.showToast('Gagal', 'Pustaka jsPDF tidak ditemui. Sila tunggu seketika.', 'danger');
            return;
        }

        try {
            const doc = new window.jspdf.jsPDF();
            const raw = record.ic_number.toString();
            const formattedIc = raw.length === 12 ? `${raw.substring(0, 6)}-${raw.substring(6, 8)}-${raw.substring(8, 12)}` : raw;

            // Brand header
            doc.setFillColor(184, 147, 36); // Dark Gold background bar
            doc.rect(0, 0, 210, 8, 'F');

            const compName = (window.companyConfig && window.companyConfig.companyName) ? window.companyConfig.companyName.toUpperCase() + ' ENTERPRISE' : 'MAWAR TERAJU ENTERPRISE';
            doc.text(compName, 14, 25);

            doc.setFontSize(10);
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text("Laporan Butiran Denda & Potongan Bulanan Dispatch", 14, 30);

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(184, 147, 36);
            doc.text("BUTIRAN POTONGAN (DEDUCTION DETAILS REPORT)", 14, 42);

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 45, 196, 45);

            // Details metadata table
            doc.autoTable({
                startY: 50,
                head: [['Butiran Dispatcher', 'Maklumat']],
                body: [
                    ["Nama Dispatcher", record.name],
                    ["ID Dispatcher", record.dispatcher_id || 'N/A'],
                    ["No. KP (IC Number)", formattedIc],
                    ["Tempoh Batch Komisen", record.batchName || 'Legacy / N/A'],
                    ["Tarikh Dijana", new Date().toLocaleString('ms-MY')]
                ],
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
            });

            // Deduction list table
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(31, 41, 55);
            doc.text("Pecahan Denda & Penalti Potongan:", 14, 98);

            const totalDeds = Number(record.deduction_advance || 0) +
                              Number(record.deduction_pending_cod || 0) +
                              Number(record.deduction_hq_penalty || 0) +
                              Number(record.deduction_duitnow_penalty || 0) +
                              Number(record.deduction_late_cod_penalty || 0) +
                              Number(record.deduction_lost_individual || 0) +
                              Number(record.deduction_lost_parcel_hub || 0);

            doc.autoTable({
                startY: 102,
                head: [['Kod / Jenis Potongan', 'Amaun Potongan']],
                body: [
                    ["DEDUCTION: ADVANCE (Duit Muka)", `RM ${Number(record.deduction_advance || 0).toFixed(2)}`],
                    ["DEDUCTION: PENDING COD (Tunggakan COD)", `RM ${Number(record.deduction_pending_cod || 0).toFixed(2)}`],
                    ["DEDUCTION: DUITNOW PENALTY", `RM ${Number(record.deduction_duitnow_penalty || 0).toFixed(2)}`],
                    ["DEDUCTION: LATE COD PENALTY", `RM ${Number(record.deduction_late_cod_penalty || 0).toFixed(2)}`],
                    ["QC PENALTY (Butiran Denda)", `RM ${Number(record.qc_penalty || 0).toFixed(2)}`],
                    ["RCGEN PENALTY (Butiran Denda)", `RM ${Number(record.rcgen_penalty || 0).toFixed(2)}`],
                    ["ARBI INDIVIDUAL (Butiran Denda)", `RM ${Number(record.arbi_individual || 0).toFixed(2)}`],
                    ["TOTAL HQ PENALTY (Denda HQ)", `RM ${Number(record.deduction_hq_penalty || 0).toFixed(2)}`],
                    ["LOST PIC SIGNED (Denda Lost)", `RM ${Number(record.lost_pic_signed || 0).toFixed(2)}`],
                    ["LOST RATE (Denda Lost)", `RM ${Number(record.lost_rate || 0).toFixed(2)}`],
                    ["LOST PARCEL PIC SIGNED (Barang Hilang Individu)", `RM ${Number(record.lost_parcel_pic_signed || 0).toFixed(2)}`],
                    ["TOTAL ALL LOST SHARED (Barang Hilang Hub)", `RM ${Number(record.total_all_lost_shared || 0).toFixed(2)}`],
                    ["TOTAL DEDUCTIONS (Jumlah Potongan)", `RM ${totalDeds.toFixed(2)}`]
                ],
                theme: 'striped',
                styles: { fontSize: 9.5, cellPadding: 3 },
                headStyles: { fillColor: [184, 147, 36], textColor: 255 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("Laporan Potongan ini dihasilkan secara automatik untuk rujukan Dispatcher.", 14, 285);
                doc.text(`Halaman ${i} daripada ${pageCount}`, 180, 285);
            }

            doc.save(`Butiran_Potongan_${record.name.replace(/\s+/g, '_')}_${(record.batchName || 'Legacy').replace(/\s+/g, '_')}.pdf`);
            App.showToast('Download Berjaya', 'PDF Butiran Potongan berjaya dimuat turun.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'PDF Deduction');
        }
    }
};

window.Dispatch = Dispatch;
