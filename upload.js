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
        const listBtn = document.getElementById('tab-batch-list-btn');
        const createBtn = document.getElementById('tab-create-batch-btn');
        const listTab = document.getElementById('batch-list-tab');
        const createTab = document.getElementById('create-batch-tab');

        if (tabId === 'batch-list') {
            if (listBtn) listBtn.classList.add('active');
            if (createBtn) createBtn.classList.remove('active');
            if (listTab) listTab.style.display = 'block';
            if (createTab) createTab.style.display = 'none';
            this.resetBatchForm();
        } else {
            if (listBtn) listBtn.classList.remove('active');
            if (createBtn) createBtn.classList.add('active');
            if (listTab) listTab.style.display = 'none';
            if (createTab) createTab.style.display = 'block';
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
            App.showToast('Format Fail Salah', 'Sila muat naik fail Excel (.xlsx atau .xls) sahaja.', 'danger');
            this.clearFile(type);
            return;
        }

        if (type === 'commission') {
            this.tempCommissionFile = file;
            document.getElementById('comm-file-name').textContent = file.name;
            document.getElementById('comm-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
            document.getElementById('comm-upload-zone').style.display = 'none';
            document.getElementById('comm-file-details').style.display = 'flex';
        } else {
            this.tempDeductionFile = file;
            document.getElementById('ded-file-name').textContent = file.name;
            document.getElementById('ded-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
            document.getElementById('ded-upload-zone').style.display = 'none';
            document.getElementById('ded-file-details').style.display = 'flex';
        }

        this.updatePublishButtonState();
        App.showToast('Fail Dipilih', `Fail ${type === 'commission' ? 'Komisen' : 'Potongan'} sedia untuk diimport.`, 'success');
    },

    clearFile(type) {
        if (type === 'commission') {
            this.tempCommissionFile = null;
            const input = document.getElementById('comm-file-input');
            if (input) input.value = '';
            document.getElementById('comm-upload-zone').style.display = 'flex';
            document.getElementById('comm-file-details').style.display = 'none';
        } else {
            this.tempDeductionFile = null;
            const input = document.getElementById('ded-file-input');
            if (input) input.value = '';
            document.getElementById('ded-upload-zone').style.display = 'flex';
            document.getElementById('ded-file-details').style.display = 'none';
        }
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
            App.showToast('Nama Batch Kosong', 'Sila masukkan nama bagi tempoh komisen batch.', 'warning');
            return;
        }

        if (!this.tempCommissionFile || !this.tempDeductionFile) {
            console.warn('[Upload.saveBatch Validation Failed] Missing required files. Commission:', this.tempCommissionFile, 'Deduction:', this.tempDeductionFile);
            App.showToast('Fail Tidak Lengkap', 'Kedua-dua fail (Laporan Komisen & Butiran Potongan) wajib dipilih sebelum diimport.', 'danger');
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

            // 1. Upload Commission file
            if (progressBar) progressBar.style.width = '25%';
            if (progressPercent) progressPercent.textContent = '25%';
            App.showToast('Memuat Naik', 'Menghantar Laporan Komisen ke pelayan...', 'info');

            const commFormData = new FormData();
            commFormData.append('file', this.tempCommissionFile);
            commFormData.append('month', month);
            commFormData.append('year', year);
            commFormData.append('name', batchName);
            commFormData.append('overwrite', 'true');

            const commRes = await window.apiFetch('/api/v1/upload/commission', {
                method: 'POST',
                body: commFormData
            });

            if (!commRes.ok) {
                const errResult = await commRes.json().catch(() => ({}));
                throw new Error(errResult.message || 'Gagal memuat naik Laporan Komisen.');
            }

            const commData = await commRes.json();
            const commBatchId = commData.data.batchId;
            const commSummary = commData.data.summary;

            // Fetch commission records from backend to display
            const commDetails = await window.apiFetch(`/api/v1/upload/${commBatchId}`).then(r => r.json());
            const commRecords = commDetails.data?.records || [];

            // 2. Upload Deduction file
            if (progressBar) progressBar.style.width = '55%';
            if (progressPercent) progressPercent.textContent = '55%';
            App.showToast('Memuat Naik', 'Menghantar Butiran Potongan ke pelayan...', 'info');

            const dedFormData = new FormData();
            dedFormData.append('file', this.tempDeductionFile);
            dedFormData.append('month', month);
            dedFormData.append('year', year);
            dedFormData.append('name', batchName);
            dedFormData.append('overwrite', 'true');

            const dedRes = await window.apiFetch('/api/v1/upload/deduction', {
                method: 'POST',
                body: dedFormData
            });

            if (!dedRes.ok) {
                const errResult = await dedRes.json().catch(() => ({}));
                throw new Error(errResult.message || 'Gagal memuat naik Butiran Potongan.');
            }

            const dedData = await dedRes.json();
            const dedBatchId = dedData.data.batchId;
            const dedSummary = dedData.data.summary;

            // Fetch deduction records from backend to display
            const dedDetails = await window.apiFetch(`/api/v1/upload/${dedBatchId}`).then(r => r.json());
            const dedRecords = dedDetails.data?.records || [];

            if (progressBar) progressBar.style.width = '80%';
            if (progressPercent) progressPercent.textContent = '80%';

            // 3. Publishing if status is 'published'
            if (status === 'published') {
                App.showToast('Menerbitkan', 'Mengaktifkan batch komisen...', 'info');
                await window.apiFetch(`/api/v1/upload/publish/${commBatchId}`, { method: 'POST' });
                await window.apiFetch(`/api/v1/upload/publish/${dedBatchId}`, { method: 'POST' });
            }

            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';

            App.showToast(
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

            App.showToast('Batch Dipilih', `Batch "${batch.name}" sedia untuk dikemas kini. Sila muat naik fail baharu.`, 'info');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Load Draft Batch');
        }
    },

    /**
     * Downloads split Excel report templates.
     */
    downloadSplitTemplate(type) {
        if (typeof XLSX === 'undefined') {
            App.showToast('Gagal', 'Pustaka SheetJS belum dimuatkan sepenuhnya.', 'danger');
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
            
            App.showToast('Muat Turun Berjaya', `Templat ${type} berjaya diunduh.`, 'success');
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
        try {
            document.getElementById('batch-name-input').value = "Julai 2026";
            
            const commBlob = new Blob(["mock commission data"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const dedBlob = new Blob(["mock deduction data"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            
            this.tempCommissionFile = new File([commBlob], 'komisen_julai_2026_simulasi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.tempDeductionFile = new File([dedBlob], 'potongan_julai_2026_simulasi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            document.getElementById('comm-file-name').textContent = this.tempCommissionFile.name;
            document.getElementById('comm-file-size').textContent = '10.0 KB';
            document.getElementById('comm-upload-zone').style.display = 'none';
            document.getElementById('comm-file-details').style.display = 'flex';

            document.getElementById('ded-file-name').textContent = this.tempDeductionFile.name;
            document.getElementById('ded-file-size').textContent = '8.0 KB';
            document.getElementById('ded-upload-zone').style.display = 'none';
            document.getElementById('ded-file-details').style.display = 'flex';

            this.updatePublishButtonState();
            App.showToast('Simulasi Berjaya', 'Data contoh Julai 2026 sedia diterbitkan.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Simulation Batch');
        }
    }
};

window.Upload = Upload;
