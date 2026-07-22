/**
 * upload.js - File Upload & Import Management Module (Batch Support)
 * Handles double dropzones, file parsing validations, draft/publish workflows,
 * and database integration for commission batches.
 */

const Upload = {
    isUploadEventsBound: false,

    // Temp storage for batch creation
    tempCommissionFile: null,
    tempDeductionFile: null,
    tempPenaltyFile: null,
    tempCommissionRecords: [],
    tempDeductionRecords: [],

    /**
     * Binds event listeners to all dropzones.
     */
    bindUploadEvents() {
        if (this.isUploadEventsBound) return;

        // 2. Commission Upload Zone
        const commZone = window.DomCache.get('comm-upload-zone');
        if (commZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                commZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                commZone.addEventListener(eventName, () => {
                    commZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                commZone.addEventListener(eventName, () => {
                    commZone.classList.remove('dragover');
                }, false);
            });

            commZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    const mockEvent = { target: { files: [files[0]] } };
                    this.handleBatchFileSelect(mockEvent, 'commission');
                }
            });
        }

        // 3. Deduction Upload Zone
        const dedZone = window.DomCache.get('ded-upload-zone');
        if (dedZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dedZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dedZone.addEventListener(eventName, () => {
                    dedZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dedZone.addEventListener(eventName, () => {
                    dedZone.classList.remove('dragover');
                }, false);
            });

            dedZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    const mockEvent = { target: { files: [files[0]] } };
                    this.handleBatchFileSelect(mockEvent, 'deduction');
                }
            });
        }

        // 4. Penalty Upload Zone
        const penaltyZone = window.DomCache.get('penalty-upload-zone');
        if (penaltyZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                penaltyZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                penaltyZone.addEventListener(eventName, () => {
                    penaltyZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                penaltyZone.addEventListener(eventName, () => {
                    penaltyZone.classList.remove('dragover');
                }, false);
            });

            penaltyZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    const mockEvent = { target: { files: [files[0]] } };
                    this.handlePenaltyFileSelect(mockEvent);
                }
            });
        }

        // Add change listener to batch name input to update publish button dynamically
        const nameInput = window.DomCache.get('batch-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.updatePublishButtonState());
        }

        this.isUploadEventsBound = true;
    },

    /* =========================================================================
       NEW BATCH CONTROLLER WORKFLOWS
       ========================================================================= */

    /**
     * Switches dashboard views between batch listing and new batch form.
     */
    switchTab(tabId) {
        console.log('[Upload.switchTab] Called with tabId:', tabId);
        const listBtn = document.getElementById('tab-batch-list-btn');
        const createBtn = document.getElementById('tab-create-batch-btn');
        const penaltyBtn = document.getElementById('tab-upload-penalty-btn');
        
        const listTab = document.getElementById('batch-list-tab');
        const createTab = document.getElementById('create-batch-tab');
        const penaltyTab = document.getElementById('upload-penalty-tab');

        const tabs = [
            { id: 'batch-list', btn: listBtn, tab: listTab },
            { id: 'create-batch', btn: createBtn, tab: createTab },
            { id: 'upload-penalty', btn: penaltyBtn, tab: penaltyTab }
        ];

        tabs.forEach(t => {
            if (t.btn) {
                if (t.id === tabId) t.btn.classList.add('active');
                else t.btn.classList.remove('active');
            }
            if (t.tab) {
                if (t.id === tabId) {
                    t.tab.style.display = 'block';
                    t.tab.classList.add('active');
                    // Force reflow to retrigger CSS fadeIn animation
                    t.tab.style.animation = 'none';
                    void t.tab.offsetHeight;
                    t.tab.style.animation = '';
                } else {
                    t.tab.style.display = 'none';
                    t.tab.classList.remove('active');
                }
            }
        });

        if (tabId === 'batch-list') {
            this.resetBatchForm();
        } else if (tabId === 'upload-penalty') {
            this.clearPenaltyFile();
        }
    },

    /**
     * Handles file selection for separate reports in the batch creator.
     */
    async handleBatchFileSelect(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            window.UI.showToast('Format Fail Salah', 'Sila muat naik fail Excel (.xlsx atau .xls) sahaja.', 'danger');
            this.clearFile(type);
            return;
        }

        // Set BOTH files to the selected file
        this.tempCommissionFile = file;
        this.tempDeductionFile = file;

        // Update BOTH UI elements to display this file
        document.getElementById('comm-file-name').textContent = file.name;
        document.getElementById('comm-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('comm-upload-zone').style.display = 'none';
        document.getElementById('comm-file-details').style.display = 'flex';

        document.getElementById('ded-file-name').textContent = file.name;
        document.getElementById('ded-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('ded-upload-zone').style.display = 'none';
        document.getElementById('ded-file-details').style.display = 'flex';

        this.updatePublishButtonState();
        window.UI.showToast('Fail Dipilih', `Fail Excel sedia untuk diimport bagi kedua-dua laporan.`, 'success');
    },

    clearFile(type) {
        this.tempCommissionFile = null;
        this.tempDeductionFile = null;
        
        const commInput = document.getElementById('comm-file-input');
        if (commInput) commInput.value = '';
        document.getElementById('comm-upload-zone').style.display = 'flex';
        document.getElementById('comm-file-details').style.display = 'none';

        const dedInput = document.getElementById('ded-file-input');
        if (dedInput) dedInput.value = '';
        document.getElementById('ded-upload-zone').style.display = 'flex';
        document.getElementById('ded-file-details').style.display = 'none';

        this.updatePublishButtonState();
    },

    updatePublishButtonState() {
        const nameVal = document.getElementById('batch-name-input').value.trim();
        const hasComm = !!this.tempCommissionFile;
        const hasDed = !!this.tempDeductionFile;
        
        const btnPublish = document.getElementById('btn-publish-batch');
        if (btnPublish) {
            btnPublish.disabled = !(nameVal && hasComm && hasDed);
        }
    },

    resetBatchForm() {
        document.getElementById('batch-name-input').value = '';
        document.getElementById('edit-batch-id').value = '';
        document.getElementById('create-batch-title').innerHTML = `<i data-lucide="upload-cloud" style="color: var(--primary);"></i> Muat Naik Fail Batch Baharu`;
        
        this.clearFile('commission');
        this.clearFile('deduction');
        
        const validationContainer = document.getElementById('validation-container');
        if (validationContainer) validationContainer.style.display = 'none';

        const progressContainer = document.getElementById('import-progress-container');
        if (progressContainer) progressContainer.style.display = 'none';
    },

    /**
     * Commits a draft or published batch to PostgreSQL via multipart REST API upload.
     */
    async saveBatch(status) {
        console.log('[DEBUG] Upload.saveBatch triggered. Target Status:', status);
        const batchName = document.getElementById('batch-name-input').value.trim();
        console.log('[DEBUG] Upload.saveBatch input batchName:', batchName);
        console.log('[DEBUG] Upload.saveBatch tempCommissionFile:', this.tempCommissionFile);
        console.log('[DEBUG] Upload.saveBatch tempDeductionFile:', this.tempDeductionFile);

        if (!batchName) {
            console.warn('[Upload.saveBatch Validation Failed] Batch name is empty');
            window.UI.showToast('Nama Batch Kosong', 'Sila masukkan nama bagi tempoh komisen batch.', 'warning');
            return;
        }

        if (!this.tempCommissionFile || !this.tempDeductionFile) {
            console.warn('[Upload.saveBatch Validation Failed] Missing required files. Commission:', this.tempCommissionFile, 'Deduction:', this.tempDeductionFile);
            window.UI.showToast('Fail Tidak Lengkap', 'Kedua-dua fail (Laporan Komisen & Butiran Potongan) wajib dipilih sebelum diimport.', 'danger');
            return;
        }

        const btnSaveDraft = document.getElementById('btn-save-draft');
        const btnPublish = document.getElementById('btn-publish-batch');
        const progressContainer = document.getElementById('import-progress-container');
        const progressBar = document.getElementById('import-progress-bar');
        const progressPercent = document.getElementById('import-progress-percent');

        if (btnSaveDraft) btnSaveDraft.disabled = true;
        if (btnPublish) btnPublish.disabled = true;
        if (progressContainer) progressContainer.style.display = 'block';

        try {
            const { month, year } = parsePeriodFromName(batchName);

            // 1. Upload Combined Excel file
            if (progressBar) progressBar.style.width = '40%';
            if (progressPercent) progressPercent.textContent = '40%';
            window.UI.showToast('Memuat Naik', 'Menghantar fail Excel ke pelayan...', 'info');

            const batchFormData = new FormData();
            batchFormData.append('file', this.tempCommissionFile);
            batchFormData.append('month', month);
            batchFormData.append('year', year);
            batchFormData.append('name', batchName);
            batchFormData.append('overwrite', 'true');

            const batchRes = await window.apiFetch('/api/v1/upload/batch', {
                method: 'POST',
                body: batchFormData
            });

            if (!batchRes.ok) {
                const errResult = await batchRes.json().catch(() => ({}));
                const errMsg = errResult.message || 'Gagal memuat naik fail Excel: Sila pastikan format, nama sheet, dan susunan lajur fail adalah betul.';
                throw new Error(errMsg);
            }

            const batchResult = await batchRes.json();
            const commBatchId = batchResult.data.commBatchId;
            const dedBatchId = batchResult.data.dedBatchId;
            const commSummary = batchResult.data.commSummary;
            const dedSummary = batchResult.data.dedSummary;

            // Fetch commission records from backend to display
            const commDetails = await window.apiFetch(`/api/v1/upload/${commBatchId}`).then(r => r.json());
            const commRecords = commDetails.data?.records || [];

            // Fetch deduction records from backend to display
            const dedDetails = await window.apiFetch(`/api/v1/upload/${dedBatchId}`).then(r => r.json());
            const dedRecords = dedDetails.data?.records || [];

            if (progressBar) progressBar.style.width = '80%';
            if (progressPercent) progressPercent.textContent = '80%';

            // 2. Publishing if status is 'published'
            if (status === 'published') {
                window.UI.showToast('Menerbitkan', 'Mengaktifkan batch komisen...', 'info');
                await window.apiFetch(`/api/v1/upload/publish/${commBatchId}`, { method: 'POST' });
                await window.apiFetch(`/api/v1/upload/publish/${dedBatchId}`, { method: 'POST' });
            }

            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';

            window.UI.showToast(
                'Import Selesai',
                `Batch "${batchName}" berjaya disimpan sebagai ${status === 'published' ? 'Terbit & Aktif' : 'Draf'}.`,
                'success'
            );

            // Display backend validation summary & imported records
            const validationContainer = document.getElementById('validation-container');
            const listItems = document.getElementById('validation-list-items');

            if (validationContainer && listItems) {
                validationContainer.style.display = 'block';
                validationContainer.style.background = 'rgba(16, 185, 129, 0.05)';
                validationContainer.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                
                const header = validationContainer.querySelector('.validation-header');
                if (header) {
                    header.style.color = 'var(--success)';
                    header.innerHTML = '<i data-lucide="check-circle"></i> <span>Ringkasan Validasi & Import Pelayan</span>';
                }

                listItems.innerHTML = `
                    ${batchResult.warnings && batchResult.warnings.length > 0 ? `
                    <div class="warning-alert" style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent); border-radius: 4px;">
                        <h5 style="margin: 0 0 0.4rem 0; color: var(--accent); display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 600;">
                            <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> Amaran Konflik Nombor IC (IC Conflict Warning)
                        </h5>
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.3;">
                            No. IC berikut dikaitkan dengan lebih daripada satu nama berbeza dalam data fail Excel. Sila semak dengan HQ untuk pembetulan punca data:
                        </p>
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem; color: var(--text-secondary); list-style-type: disc; line-height: 1.4;">
                            ${batchResult.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    <div style="margin-bottom: 1rem;">
                        <h5 style="margin: 0 0 0.25rem 0; color: var(--text-primary);">1. Laporan Komisen</h5>
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; list-style-type: disc;">
                            <li><strong>Jumlah Diimport:</strong> ${commSummary.recordsImported} rekod</li>
                            <li><strong>Dilangkau:</strong> ${commSummary.recordsSkipped}</li>
                            <li><strong>Pendua:</strong> ${commSummary.duplicates}</li>
                            <li><strong>Ralat:</strong> ${commSummary.errors}</li>
                        </ul>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <h5 style="margin: 0 0 0.25rem 0; color: var(--text-primary);">2. Butiran Potongan</h5>
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; list-style-type: disc;">
                            <li><strong>Jumlah Diimport:</strong> ${dedSummary.recordsImported} rekod</li>
                            <li><strong>Dilangkau:</strong> ${dedSummary.recordsSkipped}</li>
                            <li><strong>Pendua:</strong> ${dedSummary.duplicates}</li>
                            <li><strong>Ralat:</strong> ${dedSummary.errors}</li>
                        </ul>
                    </div>
                `;

                if (commRecords.length > 0) {
                    const previewTitle = document.createElement('h5');
                    previewTitle.style.margin = '1rem 0 0.5rem 0';
                    previewTitle.style.color = 'var(--text-primary)';
                    previewTitle.textContent = `Senarai Rekod Komisen Diimport (Pratinjau 50 rekod teratas)`;
                    listItems.appendChild(previewTitle);

                    const tableDiv = document.createElement('div');
                    tableDiv.style.maxHeight = '150px';
                    tableDiv.style.overflowY = 'auto';
                    tableDiv.style.border = '1px solid var(--border-color)';
                    tableDiv.style.borderRadius = '6px';
                    tableDiv.style.marginTop = '0.5rem';

                    const table = document.createElement('table');
                    table.className = 'data-table';
                    table.style.fontSize = '0.7rem';
                    table.style.width = '100%';

                    const keys = ['dispatcher_id', 'name', 'ic_number', 'total_commission', 'nett_commission', 'final_amount_to_pay'];
                    
                    const thead = document.createElement('thead');
                    const headerTr = document.createElement('tr');
                    keys.forEach(k => {
                        const th = document.createElement('th');
                        th.textContent = k.replace(/_/g, ' ').toUpperCase();
                        headerTr.appendChild(th);
                    });
                    thead.appendChild(headerTr);
                    table.appendChild(thead);

                    const tbody = document.createElement('tbody');
                    commRecords.slice(0, 50).forEach(rec => {
                        const tr = document.createElement('tr');
                        keys.forEach(k => {
                            const td = document.createElement('td');
                            td.textContent = rec[k] !== null && rec[k] !== undefined ? rec[k] : '';
                            tr.appendChild(td);
                        });
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    tableDiv.appendChild(table);
                    listItems.appendChild(tableDiv);
                }

                if (window.UI) window.UI.renderIcons();
            }

            document.getElementById('batch-name-input').value = '';
            document.getElementById('edit-batch-id').value = '';
            this.clearFile('commission');
            this.clearFile('deduction');
            if (progressContainer) progressContainer.style.display = 'none';

            window.Dashboard.loadDashboardStats();
            this.switchTab('batch-list');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Save Batch');
            if (btnSaveDraft) btnSaveDraft.disabled = false;
            if (btnPublish) btnPublish.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
            this.updatePublishButtonState();
        }
    },

    /**
     * Loads a draft batch back into the creator workspace for editing.
     */
    async editDraft(batchId) {
        try {
            const response = await window.apiFetch(`/api/v1/upload/${batchId}`);
            if (!response.ok) return;

            const resData = await response.json();
            const batch = resData.data?.batch;
            if (!batch) return;

            this.switchTab('create-batch');
            document.getElementById('edit-batch-id').value = batch.id;
            document.getElementById('batch-name-input').value = batch.name;
            document.getElementById('create-batch-title').innerHTML = `<i data-lucide="edit-3" style="color: var(--primary);"></i> Kemas Kini Batch "${batch.name}"`;

            window.UI.showToast('Batch Dipilih', `Batch "${batch.name}" sedia untuk dikemas kini. Sila muat naik fail baharu.`, 'info');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Load Draft Batch');
        }
    },

    /**
     * Downloads split Excel report templates.
     */
    downloadSplitTemplate(type) {
        if (typeof XLSX === 'undefined') {
            window.UI.showToast('Gagal', 'Pustaka SheetJS belum dimuatkan sepenuhnya.', 'danger');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            let headers, sampleRows;
            if (type === 'commission') {
                headers = [
                    "Delivery Dispatcher IC No.", "Delivery Dispatcher ID", "Delivery Dispatcher Name", 
                    "Parcel Quantity", "Parcel Commission", "Extra Weight Commission", "Total Commission", 
                    "ADD: REFUND PENALTY", "ADD: PICKUP COMMISSION", "ADD: OTHERS", "ADD: SORTER", 
                    "NETT COMMISSION"
                ];
                sampleRows = [
                    ["070614-10-1708", "NSN3052004", "Mohamad Azlan Bin Jaapar", 150, 1.15, 8.50, 181.00, 5.00, 15.30, 0.00, 0.00, 201.30],
                    ["850202-08-5678", "DSP999", "Chong Wei Kang", 200, 1.15, 0.00, 230.00, 0.00, 50.00, 0.00, 0.00, 280.00]
                ];
            } else {
                headers = [
                    "Delivery Dispatcher IC No.", "Delivery Dispatcher ID", "Delivery Dispatcher Name", 
                    "DEDUCTION: ADVANCE", "DEDUCTION: PENDING COD", "DEDUCTION: HQ PENALTY", 
                    "DEDUCTION: DUITNOW PENALTY", "DEDUCTION: LATE COD PENALTY", 
                    "DEDUCTION: LOST INDIVIDUAL", "DEDUCTION: LOST PARCEL HUB"
                ];
                sampleRows = [
                    ["070614-10-1708", "NSN3052004", "Mohamad Azlan Bin Jaapar", 50.00, 0.00, 10.00, 0.00, 0.00, 0.00, 0.00],
                    ["850202-08-5678", "DSP999", "Chong Wei Kang", 0.00, 0.00, 15.00, 0.00, 0.00, 0.00, 0.00]
                ];
            }

            const wsData = [headers, ...sampleRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, type === 'commission' ? "Komisen" : "Potongan");
            XLSX.writeFile(wb, `templat_${type}_mawar_teraju.xlsx`);
            
            window.UI.showToast('Muat Turun Berjaya', `Templat ${type} berjaya diunduh.`, 'success');
            if (window.DB) {
                window.DB.log('Muat Turun Templat', `Admin memuat turun templat ${type}.`, 'Admin');
            }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Download Template');
        }
    },

    /**
     * Populates simulation mock files for batch creator testing.
     */
    runSimulationBatch() {
        if (typeof XLSX === 'undefined') {
            window.UI.showToast('Gagal', 'Pustaka SheetJS belum dimuatkan sepenuhnya.', 'danger');
            return;
        }
        try {
            document.getElementById('batch-name-input').value = "Julai 2026";
            
            // Generate valid combined workbook
            const commWb = XLSX.utils.book_new();
            const commHeaders = [
                "Delivery Dispatcher IC No.", "Delivery Dispatcher ID", "Delivery Dispatcher Name", 
                "Parcel Quantity", "Parcel Commission", "Extra Weight Commission", "Total Commission", 
                "ADD: REFUND PENALTY", "ADD: PICKUP COMMISSION", "ADD: OTHERS", "ADD: SORTER", 
                "ADD: EXTRA REWARD", "NETT COMMISSION"
            ];
            const commRows = [
                commHeaders,
                ["070614-10-1708", "NSN3052004", "Mohamad Azlan Bin Jaapar", 150, 1.15, 8.50, 181.00, 5.00, 15.30, 0.00, 0.00, 0.00, 201.30]
            ];
            const commWs = XLSX.utils.aoa_to_sheet(commRows);
            XLSX.utils.book_append_sheet(commWb, commWs, "Commission");

            // Generate valid Deduction sheet
            const dedHeaders = [
                "Delivery Dispatcher IC No.", "Delivery Dispatcher ID", "Delivery Dispatcher Name", 
                "DEDUCTION: ADVANCE", "DEDUCTION: PENDING COD", "DEDUCTION: HQ PENALTY", 
                "DEDUCTION: DUITNOW PENALTY", "DEDUCTION: LATE COD PENALTY", 
                "DEDUCTION: LOST INDIVIDUAL", "DEDUCTION: LOST PARCEL HUB"
            ];
            const dedRows = [
                dedHeaders,
                ["070614-10-1708", "NSN3052004", "Mohamad Azlan Bin Jaapar", 50.00, 0.00, 10.00, 0.00, 0.00, 0.00, 0.00]
            ];
            const dedWs = XLSX.utils.aoa_to_sheet(dedRows);
            XLSX.utils.book_append_sheet(commWb, dedWs, "Deduction");
            
            const commOut = XLSX.write(commWb, { bookType: 'xlsx', type: 'array' });
            const commBlob = new Blob([commOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            
            this.tempCommissionFile = new File([commBlob], 'komisen_julai_2026_simulasi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.tempDeductionFile = new File([commBlob], 'potongan_julai_2026_simulasi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            document.getElementById('comm-file-name').textContent = this.tempCommissionFile.name;
            document.getElementById('comm-file-size').textContent = '10.0 KB';
            document.getElementById('comm-upload-zone').style.display = 'none';
            document.getElementById('comm-file-details').style.display = 'flex';

            document.getElementById('ded-file-name').textContent = this.tempDeductionFile.name;
            document.getElementById('ded-file-size').textContent = '8.0 KB';
            document.getElementById('ded-upload-zone').style.display = 'none';
            document.getElementById('ded-file-details').style.display = 'flex';

            this.updatePublishButtonState();
            window.UI.showToast('Simulasi Berjaya', 'Data contoh Julai 2026 sedia diterbitkan.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Simulation Batch');
        }
    },

    handlePenaltyFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            window.UI.showToast('Format Fail Salah', 'Sila muat naik fail Excel (.xlsx atau .xls) sahaja.', 'danger');
            this.clearPenaltyFile();
            return;
        }

        this.tempPenaltyFile = file;

        document.getElementById('penalty-file-name').textContent = file.name;
        document.getElementById('penalty-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('penalty-upload-zone').style.display = 'none';
        document.getElementById('penalty-file-details').style.display = 'flex';

        const btnUpload = document.getElementById('btn-upload-penalty');
        if (btnUpload) btnUpload.disabled = false;

        window.UI.showToast('Fail Dipilih', `Fail Excel denda sedia untuk dimuat naik.`, 'success');
    },

    clearPenaltyFile() {
        this.tempPenaltyFile = null;
        
        const input = document.getElementById('penalty-file-input');
        if (input) input.value = '';
        
        const uploadZone = document.getElementById('penalty-upload-zone');
        if (uploadZone) uploadZone.style.display = 'flex';
        
        const fileDetails = document.getElementById('penalty-file-details');
        if (fileDetails) fileDetails.style.display = 'none';

        const btnUpload = document.getElementById('btn-upload-penalty');
        if (btnUpload) btnUpload.disabled = true;

        const progressContainer = document.getElementById('penalty-progress-container');
        if (progressContainer) progressContainer.style.display = 'none';
    },

    async uploadPenalty() {
        if (!this.tempPenaltyFile) {
            window.UI.showToast('Fail Tidak Lengkap', 'Sila pilih fail denda sebelum memuat naik.', 'danger');
            return;
        }

        const btnUpload = document.getElementById('btn-upload-penalty');
        const progressContainer = document.getElementById('penalty-progress-container');
        const progressBarFill = document.getElementById('penalty-progress-bar-fill');
        const progressPercent = document.getElementById('penalty-progress-percent');

        if (btnUpload) btnUpload.disabled = true;
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBarFill) progressBarFill.style.width = '20%';
        if (progressPercent) progressPercent.textContent = '20%';

        try {
            window.UI.showToast('Memuat Naik', 'Menghantar fail Excel denda ke pelayan...', 'info');

            const formData = new FormData();
            formData.append('file', this.tempPenaltyFile);

            if (progressBarFill) progressBarFill.style.width = '50%';
            if (progressPercent) progressPercent.textContent = '50%';

            const res = await window.apiFetch('/api/v1/penalty/upload', {
                method: 'POST',
                body: formData
            });

            if (progressBarFill) progressBarFill.style.width = '80%';
            if (progressPercent) progressPercent.textContent = '80%';

            if (!res.ok) {
                const errResult = await res.json().catch(() => ({}));
                const errMsg = errResult.message || 'Gagal memuat naik fail Excel denda.';
                throw new Error(errMsg);
            }

            const result = await res.json();
            
            if (progressBarFill) progressBarFill.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';

            window.UI.showToast(
                'Import Berjaya',
                `Fail denda berjaya diimport. (${result.data?.summary?.recordsImported || 0} rekod)`,
                'success'
            );

            this.clearPenaltyFile();
        } catch (error) {
            if (progressContainer) progressContainer.style.display = 'none';
            if (btnUpload) btnUpload.disabled = false;
            window.ErrorHandler.handle(error, 'Upload Penalty');
        }
    }
};

window.Upload = Upload;
