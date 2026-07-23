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
            let val = e.target.value;
            const hasLetters = /[a-zA-Z]/.test(val);
            if (hasLetters) {
                e.target.value = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            } else {
                let clean = val.replace(/[^0-9]/g, '');
                let formatted = '';
                if (clean.length > 0) {
                    formatted += clean.substring(0, 6);
                }
                if (clean.length > 6) {
                    formatted += '-' + clean.substring(6, 8);
                }
                if (clean.length > 8) {
                    formatted += '-' + clean.substring(8, 12);
                }
                e.target.value = formatted;
            }
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
        const cleanQuery = rawIc.trim().toUpperCase().replace(/[\s-]/g, '');

        const isIc = /^\d{12}$/.test(cleanQuery);
        const isPassport = /^[A-Z0-9]{6,12}$/.test(cleanQuery) && !/^\d+$/.test(cleanQuery) && !/^PJS\d+$/i.test(cleanQuery);

        if (!isIc && !isPassport) {
            window.UI.showToast(
                'Format Input Salah', 
                'Format input tidak sah. Sila masukkan No. Kad Pengenalan (12 digit) atau No. Pasport yang sah.', 
                'warning'
            );
            return;
        }

        const startTime = performance.now();
        
        try {
            const records = await window.DB.searchByIc(cleanQuery);
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

                await window.DB.log('Carian Dispatcher (Gagal)', `Carian dilakukan bagi input ${rawIc}. Tiada rekod dijumpai. (Tempoh: ${latency}ms)`, 'Dispatch');
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
        try {
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
        const hasPenaltyDetails = !!record.penaltySummary;
        const pSum = record.penaltySummary || {};
        
        const hqPenaltyVal = hasPenaltyDetails ? 
          (Number(pSum.fake_return || 0) + Number(pSum.fake_problematic || 0) + Number(pSum.fraud_delivery || 0) + Number(pSum.arbitration || 0)) : 
          Number(record.deduction_hq_penalty || 0);
          
        const lostIndividualVal = hasPenaltyDetails ? 
          Number(pSum.individual_lost || 0) : 
          Number(record.deduction_lost_individual || 0);

        const grossComm = Number(record.total_commission || record.nett_commission || 0);
        const totalDeds = Number(record.deduction_others || 0) +
                          Number(record.deduction_pending_cod || 0) +
                          hqPenaltyVal +
                          Number(record.deduction_duitnow_penalty || 0) +
                          Number(record.deduction_late_cod_penalty || 0) +
                          lostIndividualVal +
                          Number(record.deduction_lost_parcel_hub || 0);

        const additions = Number(record.addition_refund_penalty || 0) +
                          Number(record.addition_pickup_commission || 0) +
                          Number(record.addition_others || 0) +
                          Number(record.addition_sorter || 0) +
                          Number(record.addition_extra_reward || 0);

        const netComm = hasPenaltyDetails ? 
          Math.max(0, grossComm + additions - totalDeds) : 
          Number(record.final_amount_to_pay || record.nett_commission || 0);

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
                { key: 'parcel_qty', label: 'Parcel Quantity', type: 'number' },
                { key: 'commission_rate', label: 'Parcel Commission', type: 'currency' },
                { key: 'extra_weight_commission', label: 'Extra Weight Commission', type: 'currency' },
                { key: 'total_commission', label: 'Total Commission', type: 'currency' },
                { key: 'addition_refund_penalty', label: 'ADD: REFUND PENALTY', type: 'currency' },
                { key: 'addition_pickup_commission', label: 'ADD: PICKUP COMMISSION', type: 'currency' },
                { key: 'addition_others', label: 'ADD: OTHERS', type: 'currency' },
                { key: 'addition_sorter', label: 'ADD: SORTER', type: 'currency' },
                { key: 'addition_extra_reward', label: 'EXTRA REWARD', type: 'currency' },
                { key: 'deduction_others', label: 'DEDUCTION: OTHERS', type: 'currency' },
                { key: 'deduction_pending_cod', label: 'DEDUCTION: PENDING COD', type: 'currency' },
                { key: 'deduction_hq_penalty', label: 'DEDUCTION: HQ PENALTY', type: 'currency' },
                { key: 'deduction_duitnow_penalty', label: 'DEDUCTION: DUITNOW PENALTY', type: 'currency' },
                { key: 'deduction_late_cod_penalty', label: 'DEDUCTION: LATE COD PENALTY', type: 'currency' },
                { key: 'deduction_lost_individual', label: 'DEDUCTION: LOST INDIVIDUAL', type: 'currency' },
                { key: 'deduction_lost_parcel_hub', label: 'DEDUCTION: LOST PARCEL HUB', type: 'currency' },
                { key: 'nett_commission', label: 'NETT COMMISSION', type: 'currency' }
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
                if (hasPenaltyDetails && field.key === 'deduction_hq_penalty') {
                    const penalty = record.penaltySummary || {};
                    const fakeReturn = penalty.fake_return || 0;
                    const fakeProblematic = penalty.fake_problematic || 0;
                    const fraudDelivery = penalty.fraud_delivery || 0;
                    const arbitration = penalty.arbitration || 0;

                    fieldsHtml += `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.85rem; font-style: italic;">
                            <span style="color: var(--text-secondary);">↳ FAKE RETURN</span>
                            <span style="color: var(--danger); font-weight: 600;">${fakeReturn > 0 ? 'RM ' + fakeReturn.toFixed(2) : '-'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.85rem; font-style: italic;">
                            <span style="color: var(--text-secondary);">↳ FAKE PROBLEMATIC</span>
                            <span style="color: var(--danger); font-weight: 600;">${fakeProblematic > 0 ? 'RM ' + fakeProblematic.toFixed(2) : '-'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.85rem; font-style: italic;">
                            <span style="color: var(--text-secondary);">↳ FRAUD DELIVERY</span>
                            <span style="color: var(--danger); font-weight: 600;">${fraudDelivery > 0 ? 'RM ' + fraudDelivery.toFixed(2) : '-'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.85rem; font-style: italic;">
                            <span style="color: var(--text-secondary);">↳ ARBITRATION</span>
                            <span style="color: var(--danger); font-weight: 600;">${arbitration > 0 ? 'RM ' + arbitration.toFixed(2) : '-'}</span>
                        </div>
                    `;
                    return;
                }

                if (hasPenaltyDetails && field.key === 'deduction_lost_individual') {
                    const penalty = record.penaltySummary || {};
                    const lostInd = penalty.individual_lost || 0;
                    const dispId = record.dispatcher_id || '';
                    const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
                    const penaltyUrl = isLocalTesting ? `http://localhost:3000?dispatcher_id=${dispId}` : `https://penalty.reekod.com?dispatcher_id=${dispId}`;

                    fieldsHtml += `
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 0.9rem; align-items: center;">
                            <span style="color: var(--text-secondary); text-transform: none;">DEDUCTION: LOST INDIVIDUAL</span>
                            <a href="${penaltyUrl}" target="_blank" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.05); color: var(--text-primary); text-decoration: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
                                <span>${lostInd > 0 ? 'RM ' + lostInd.toFixed(2) : '-'}</span>
                                <i data-lucide="external-link" style="width: 12px; height: 12px; color: var(--primary);"></i>
                            </a>
                        </div>
                    `;
                    return;
                }

                let val = record[field.key];
                let displayValue = val;

                if (field.type === 'currency') {
                    const numVal = parseFloat(val);
                    if (isNaN(numVal) || numVal === 0) {
                        displayValue = '-';
                    } else {
                        displayValue = `RM ${numVal.toFixed(2)}`;
                    }
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

        window.DB.log('Carian Dispatcher (Sukses)', `Carian bagi input ${rawIc} menjumpai rekod komisen. (Tempoh: ${latency}ms)`, 'Dispatch').catch(() => {});
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
        if (!record || !record.commission_record_id) {
            window.UI.showToast('Gagal', 'Tiada rekod komisen ditemui untuk dimuat turun.', 'warning');
            return;
        }

        try {
            const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
            const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
            window.location.href = `${baseUrl}/api/v1/reports/commission/${record.commission_record_id}`;
            window.UI.showToast('Download Berjaya', 'PDF Laporan Komisen sedang dimuat turun.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'PDF Commission Download');
        }
    },

    /**
     * Downloads Deduction Details report as PDF.
     */
    downloadDeductionDetailsPDF() {
        const record = this.currentSearchedRecord;
        if (!record || !record.deduction_record_id) {
            window.UI.showToast('Gagal', 'Tiada rekod potongan ditemui untuk dimuat turun.', 'warning');
            return;
        }

        try {
            const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
            const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
            window.location.href = `${baseUrl}/api/v1/reports/deduction/${record.deduction_record_id}`;
            window.UI.showToast('Download Berjaya', 'PDF Butiran Potongan sedang dimuat turun.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'PDF Deduction Download');
        }
    },

    /**
     * Downloads Combined Commission and Deduction Report as a single PDF.
     */
    downloadCombinedReportPDF() {
        const record = this.currentSearchedRecord;
        if (!record) {
            window.UI.showToast('Gagal', 'Tiada rekod ditemui untuk dimuat turun.', 'warning');
            return;
        }

        const commId = record.commission_record_id || 'none';
        const dedId = record.deduction_record_id || 'none';

        if (commId === 'none' && dedId === 'none') {
            window.UI.showToast('Gagal', 'Tiada rekod komisen atau potongan untuk dimuat turun.', 'warning');
            return;
        }

        try {
            const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
            const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
            window.location.href = `${baseUrl}/api/v1/reports/combined/${commId}/${dedId}`;
            window.UI.showToast('Download Berjaya', 'PDF Laporan Gabungan sedang dimuat turun.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'PDF Combined Download');
        }
    }
};

window.Dispatch = Dispatch;
