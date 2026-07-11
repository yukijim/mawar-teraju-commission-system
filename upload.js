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

        // 1. Legacy Dropzone (for backwards compatibility / regression tests)
        const uploadZone = window.DomCache.get('upload-zone');
        const fileInput = window.DomCache.get('excel-file-input');
        
        if (uploadZone && fileInput) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadZone.addEventListener(eventName, () => {
                    uploadZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadZone.addEventListener(eventName, () => {
                    uploadZone.classList.remove('dragover');
                }, false);
            });

            uploadZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });
        }

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

    /**
     * Legacy single-file select handler for backward compatibility.
     */
    async handleFileSelect(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            App.showToast('Format Fail Salah', 'Sila muat naik fail Excel (.xlsx atau .xls) sahaja.', 'danger');
            this.cancelFileSelection();
            return;
        }

        App.selectedFile = file;

        const nameEl = window.DomCache.get('selected-file-name');
        const sizeEl = window.DomCache.get('selected-file-size');
        const uploadZone = window.DomCache.get('upload-zone');
        const detailsContainer = window.DomCache.get('file-details-container');
        const helperInfo = window.DomCache.get('upload-helper-info');
        const validationContainer = window.DomCache.get('validation-container');
        const confirmBtn = window.DomCache.get('btn-confirm-import');
        const strategyContainer = window.DomCache.get('strategy-container');

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        
        if (uploadZone) uploadZone.style.display = 'none';
        if (detailsContainer) detailsContainer.style.display = 'flex';
        if (helperInfo) helperInfo.style.display = 'none';

        try {
            App.showToast('Membaca Fail', 'Sedang memproses kandungan fail Excel...', 'info');
            const rawRows = await window.ExcelParser.parseFile(file);
            const analysisResult = window.ExcelParser.analyzeAndMap(rawRows, 'consolidated');
            
            if (!analysisResult.isValid) {
                const listContainer = window.DomCache.get('validation-list-items');
                if (listContainer) {
                    listContainer.innerHTML = '';
                    analysisResult.errors.forEach(err => {
                        const li = document.createElement('li');
                        li.textContent = err;
                        listContainer.appendChild(li);
                    });
                }
                if (validationContainer) validationContainer.style.display = 'block';
                if (confirmBtn) confirmBtn.disabled = true;
            } else {
                if (validationContainer) validationContainer.style.display = 'none';
                if (confirmBtn) confirmBtn.disabled = false;
            }

            App.mappedRecords = analysisResult.mappedRecords || [];
            if (strategyContainer) strategyContainer.style.display = 'block';
        } catch (error) {
            window.ErrorHandler.handle(error, 'File Select');
            this.cancelFileSelection();
        }
    },

    cancelFileSelection() {
        App.selectedFile = null;
        App.mappedRecords = [];

        const fileInput = window.DomCache.get('excel-file-input');
        if (fileInput) fileInput.value = '';

        const uploadZone = window.DomCache.get('upload-zone');
        const detailsContainer = window.DomCache.get('file-details-container');
        const validationContainer = window.DomCache.get('validation-container');
        const strategyContainer = window.DomCache.get('strategy-container');
        const helperInfo = window.DomCache.get('upload-helper-info');

        if (uploadZone) uploadZone.style.display = 'flex';
        if (detailsContainer) detailsContainer.style.display = 'none';
        if (validationContainer) validationContainer.style.display = 'none';
        if (strategyContainer) strategyContainer.style.display = 'none';
        if (helperInfo) helperInfo.style.display = 'flex';
    },

    async confirmAndImport() {
        if (!App.selectedFile || App.mappedRecords.length === 0) return;
        const strategyChecked = document.querySelector('input[name="duplicate-strategy"]:checked');
        const strategy = strategyChecked ? strategyChecked.value : 'replace';
        try {
            const result = await window.ExcelParser.importToDB(App.mappedRecords, App.selectedFile.name, strategy);
            if (result.success) {
                App.showToast('Import Selesai', `Berjaya memasukkan ${result.recordCount} baris komisen.`, 'success');
                this.cancelFileSelection();
                window.Dashboard.loadDashboardStats();
            }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Import Excel');
        }
    },

    downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            App.showToast('Gagal', 'Pustaka SheetJS belum dimuatkan sepenuhnya.', 'danger');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            const wsData = [
                ["Delivery Dispatcher ID", "Delivery Dispatcher Name", "Parcel Quantity", "Parcel YOYI", "Net Parcel", "RM1.15/Parcel Commission", "Exclude Extra Weight YOYI", "Extra Weight Commission", "Total Commission", "DEDUCTION: ADVANCE", "DEDUCTION: PENDING COD", "DEDUCTION: HQ PENALTY", "DEDUCTION: DUITNOW PENALTY", "DEDUCTION: LATE COD PENALTY", "DEDUCTION: LOST INDIVIDUAL", "DEDUCTION: LOST PARCEL HUB", "ADDITION: REFUND 15JUNE26", "ADDITION: PICKUP COMMISSION", "NETT COMMISSION", "FINAL AMOUNT TO PAY"],
                ["900101-14-1234", "Ahmad Bin Ali", 150, 10, 140, 161.00, 5, 20.00, 181.00, 50.00, 0.00, 10.00, 0.00, 0.00, 0.00, 0.00, 15.00, 25.00, 161.00, 161.00]
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Komisen Rider");
            XLSX.writeFile(wb, "templat_komisen_mawar_teraju.xlsx");
            App.showToast('Templat Dimuat Turun', 'Fail templat_komisen_mawar_teraju.xlsx berjaya diunduh.', 'success');
        } catch (error) {
            window.ErrorHandler.handle(error, 'Download Template');
        }
    },

    runTestUpload() {
        if (typeof XLSX === 'undefined') return;
        try {
            const wb = XLSX.utils.book_new();
            const wsData = [
                ["Delivery Dispatcher ID", "Delivery Dispatcher Name", "Parcel Quantity", "Parcel YOYI", "Net Parcel", "RM1.15/Parcel Commission", "Exclude Extra Weight YOYI", "Extra Weight Commission", "Total Commission", "DEDUCTION: ADVANCE", "DEDUCTION: PENDING COD", "DEDUCTION: HQ PENALTY", "DEDUCTION: DUITNOW PENALTY", "DEDUCTION: LATE COD PENALTY", "DEDUCTION: LOST INDIVIDUAL", "DEDUCTION: LOST PARCEL HUB", "ADDITION: REFUND 15JUNE26", "ADDITION: PICKUP COMMISSION", "NETT COMMISSION", "FINAL AMOUNT TO PAY"],
                ["900101-14-1234", "Ahmad Bin Ali", 150, 10, 140, 161.00, 5, 20.00, 181.00, 50.00, 0.00, 10.00, 0.00, 0.00, 0.00, 0.00, 15.00, 25.00, 161.00, 161.00]
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Komisen Rider");
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const file = new File([blob], "komisen_contoh_simulasi.xlsx", { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.handleFileSelect(file);
        } catch (error) {}
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

        try {
            App.showToast('Memproses Fail', 'Sedang membaca fail Excel...', 'info');
            const workbook = await window.ExcelParser.parseFileToWorkbook(file);
            
            const sheetNames = workbook.SheetNames;
            const hasComm = sheetNames.some(n => n.toLowerCase().includes('dispatcher comm') || n.toLowerCase().includes('comm'));
            const hasDed = sheetNames.some(n => n.toLowerCase().includes('penalty') || n.toLowerCase().includes('deduction'));

            const validationContainer = document.getElementById('validation-container');
            const listItems = document.getElementById('validation-list-items');

            if (hasComm && hasDed) {
                App.showToast('Memproses Fail', 'Fail Excel disatukan dikesan. Menganalisis Laporan Komisen & Butiran Potongan...', 'info');
                const analysisResult = window.ExcelParser.validateAndMapWorkbook(workbook);

                if (!analysisResult.isValid) {
                    if (listItems) {
                        listItems.innerHTML = '';
                        const li = document.createElement('li');
                        li.textContent = analysisResult.error;
                        listItems.appendChild(li);
                    }
                    if (validationContainer) validationContainer.style.display = 'block';
                    this.clearFile('commission');
                    this.clearFile('deduction');
                    return;
                }

                if (validationContainer) validationContainer.style.display = 'none';

                this.tempCommissionFile = file;
                this.tempCommissionRecords = analysisResult.commissionRecords;
                this.tempDeductionFile = file;
                this.tempDeductionRecords = analysisResult.deductionRecords;
                this.tempDispatcherMappings = analysisResult.dispatcherMappings;

                document.getElementById('comm-file-name').textContent = file.name;
                document.getElementById('comm-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB (${analysisResult.commissionRecords.length} rekod)`;
                document.getElementById('comm-upload-zone').style.display = 'none';
                document.getElementById('comm-file-details').style.display = 'flex';

                document.getElementById('ded-file-name').textContent = file.name;
                document.getElementById('ded-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB (${analysisResult.deductionRecords.length} rekod)`;
                document.getElementById('ded-upload-zone').style.display = 'none';
                document.getElementById('ded-file-details').style.display = 'flex';

                this.updatePublishButtonState();
                App.showToast('Selesai Validasi', 'Berjaya mengimport data komisen dan potongan daripada fail disatukan.', 'success');
            } else {
                App.showToast('Memproses Fail', `Menganalisis skema fail ${type === 'commission' ? 'Komisen' : 'Potongan'}...`, 'info');
                const analysisResult = window.ExcelParser.validateAndMapWorkbook(workbook);

                if (!analysisResult.isValid) {
                    if (listItems) {
                        listItems.innerHTML = '';
                        const li = document.createElement('li');
                        li.textContent = `${type.toUpperCase()}: ${analysisResult.error}`;
                        listItems.appendChild(li);
                    }
                    if (validationContainer) validationContainer.style.display = 'block';
                    this.clearFile(type);
                    return;
                }

                if (validationContainer) validationContainer.style.display = 'none';

                if (type === 'commission') {
                    this.tempCommissionFile = file;
                    this.tempCommissionRecords = analysisResult.commissionRecords;
                    this.tempDispatcherMappings = analysisResult.dispatcherMappings;
                    
                    document.getElementById('comm-file-name').textContent = file.name;
                    document.getElementById('comm-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB (${analysisResult.commissionRecords.length} rekod)`;
                    document.getElementById('comm-upload-zone').style.display = 'none';
                    document.getElementById('comm-file-details').style.display = 'flex';
                } else {
                    this.tempDeductionFile = file;
                    if (this.tempDispatcherMappings) {
                        const masterMap = {};
                        this.tempDispatcherMappings.forEach(m => {
                            masterMap[m.dispatcher_id] = m.ic_number;
                        });
                        analysisResult.deductionRecords.forEach(d => {
                            if (!d.ic_number && masterMap[d.dispatcher_id]) {
                                d.ic_number = masterMap[d.dispatcher_id];
                            }
                        });
                    }
                    this.tempDeductionRecords = analysisResult.deductionRecords;

                    document.getElementById('ded-file-name').textContent = file.name;
                    document.getElementById('ded-file-size').textContent = `${(file.size / 1024).toFixed(1)} KB (${analysisResult.deductionRecords.length} rekod)`;
                    document.getElementById('ded-upload-zone').style.display = 'none';
                    document.getElementById('ded-file-details').style.display = 'flex';
                }

                this.updatePublishButtonState();
                App.showToast('Fail Disahkan', `Laporan ${type === 'commission' ? 'Komisen' : 'Potongan'} lulus validasi skema.`, 'success');
            }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Parser Batch File');
            this.clearFile(type);
        }
    },

    clearFile(type) {
        if (type === 'commission') {
            this.tempCommissionFile = null;
            this.tempCommissionRecords = [];
            const input = document.getElementById('comm-file-input');
            if (input) input.value = '';
            document.getElementById('comm-upload-zone').style.display = 'flex';
            document.getElementById('comm-file-details').style.display = 'none';
        } else {
            this.tempDeductionFile = null;
            this.tempDeductionRecords = [];
            const input = document.getElementById('ded-file-input');
            if (input) input.value = '';
            document.getElementById('ded-upload-zone').style.display = 'flex';
            document.getElementById('ded-file-details').style.display = 'none';
        }
        this.updatePublishButtonState();
    },

    updatePublishButtonState() {
        const nameVal = document.getElementById('batch-name-input').value.trim();
        const hasComm = this.tempCommissionRecords.length > 0;
        const hasDed = this.tempDeductionRecords.length > 0;
        
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
     * Commits a draft or published batch to IndexedDB.
     */
    async saveBatch(status) {
        const batchName = document.getElementById('batch-name-input').value.trim();
        if (!batchName) {
            App.showToast('Nama Batch Kosong', 'Sila masukkan nama bagi tempoh komisen batch.', 'warning');
            return;
        }

        if (status === 'published' && (this.tempCommissionRecords.length === 0 || this.tempDeductionRecords.length === 0)) {
            App.showToast('Laporan Tidak Lengkap', 'Kedua-dua fail (Laporan Komisen & Butiran Potongan) wajib dimuat naik sebelum diterbitkan.', 'danger');
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

        const editIdVal = document.getElementById('edit-batch-id').value;

        try {
            let batchId;
            let existingBatch = null;

            if (editIdVal) {
                batchId = parseInt(editIdVal);
                existingBatch = await window.DB.getBatch(batchId);
            } else {
                batchId = await window.DB.createBatch(batchName, status);
                existingBatch = await window.DB.getBatch(batchId);
            }

            if (progressBar) progressBar.style.width = '30%';
            if (progressPercent) progressPercent.textContent = '30%';

            const batch = {
                id: batchId,
                name: batchName,
                status: status,
                month: existingBatch ? existingBatch.month : 6,
                year: existingBatch ? existingBatch.year : 2026,
                active: existingBatch ? existingBatch.active : 0,
                createdTime: existingBatch ? existingBatch.createdTime : Date.now(),
                publishedTime: status === 'published' ? Date.now() : (existingBatch ? existingBatch.publishedTime : null),
                commissionFilename: this.tempCommissionFile ? this.tempCommissionFile.name : (existingBatch ? existingBatch.commissionFilename : ''),
                deductionFilename: this.tempDeductionFile ? this.tempDeductionFile.name : (existingBatch ? existingBatch.deductionFilename : ''),
                commissionCount: this.tempCommissionRecords.length,
                deductionCount: this.tempDeductionRecords.length
            };

            if (progressBar) progressBar.style.width = '60%';
            if (progressPercent) progressPercent.textContent = '60%';

            if (status === 'published') {
                batch.active = 1;
                await window.DB.setActiveBatch(batchId);
            }

            // Atomic transactional database write with automatic rollback on failure
            await window.DB.saveBatchData(
                batchId,
                batch,
                this.tempCommissionRecords,
                this.tempDeductionRecords,
                this.tempDispatcherMappings || []
            );

            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';

            // Audit Trail Log
            await window.DB.log(
                `Simpan Batch (${status === 'published' ? 'Terbit' : 'Draf'})`,
                `Batch "${batchName}" disimpan dengan ${this.tempCommissionRecords.length} rekod komisen dan ${this.tempDeductionRecords.length} rekod potongan.`,
                'Admin'
            );

            App.showToast(
                'Batch Disimpan',
                `Batch "${batchName}" berjaya disimpan sebagai ${status === 'published' ? 'Terbit & Aktif' : 'Draf'}.`,
                'success'
            );

            this.resetBatchForm();
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
            const batch = await window.DB.getBatch(batchId);
            if (!batch) return;

            this.switchTab('create-batch');
            document.getElementById('edit-batch-id').value = batch.id;
            document.getElementById('batch-name-input').value = batch.name;
            document.getElementById('create-batch-title').innerHTML = `<i data-lucide="edit-3" style="color: var(--primary);"></i> Edit Draf Batch "${batch.name}"`;

            // Load details visually if filenames exist
            if (batch.commissionFilename) {
                this.tempCommissionFile = { name: batch.commissionFilename };
                document.getElementById('comm-file-name').textContent = batch.commissionFilename;
                document.getElementById('comm-file-size').textContent = `${batch.commissionCount} rekod disimpan`;
                document.getElementById('comm-upload-zone').style.display = 'none';
                document.getElementById('comm-file-details').style.display = 'flex';
                this.tempCommissionRecords = new Array(batch.commissionCount).fill({});
            }

            if (batch.deductionFilename) {
                this.tempDeductionFile = { name: batch.deductionFilename };
                document.getElementById('ded-file-name').textContent = batch.deductionFilename;
                document.getElementById('ded-file-size').textContent = `${batch.deductionCount} rekod disimpan`;
                document.getElementById('ded-upload-zone').style.display = 'none';
                document.getElementById('ded-file-details').style.display = 'flex';
                this.tempDeductionRecords = new Array(batch.deductionCount).fill({});
            }

            this.updatePublishButtonState();
            App.showToast('Draf Dimuatkan', `Batch "${batch.name}" sedia untuk diedit.`, 'info');
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
                headers = window.ExcelParser.COMMISSION_HEADERS.map(h => h.label);
                sampleRows = [
                    ["900101-14-1234", "Ahmad Bin Ali", 150, 10, 140, 161.00, 5, 20.00, 181.00, 15.00, 25.00, 161.00, 161.00],
                    ["850202-08-5678", "Chong Wei Kang", 200, 15, 185, 212.75, 0, 35.00, 247.75, 0.00, 50.00, 282.75, 282.75]
                ];
            } else {
                headers = window.ExcelParser.DEDUCTION_HEADERS.map(h => h.label);
                sampleRows = [
                    ["900101-14-1234", "Ahmad Bin Ali", 50.00, 0.00, 10.00, 0.00, 0.00, 0.00, 0.00],
                    ["850202-08-5678", "Chong Wei Kang", 0.00, 0.00, 15.00, 0.00, 0.00, 0.00, 0.00]
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
            
            this.tempCommissionFile = { name: 'komisen_julai_2026_simulasi.xlsx', size: 10240 };
            this.tempDeductionFile = { name: 'potongan_julai_2026_simulasi.xlsx', size: 8192 };
            
            this.tempCommissionRecords = [
                {
                    ic_number: "900101141234",
                    name: "Ahmad Bin Ali",
                    parcel_qty: 150,
                    parcel_yoyi: 10,
                    net_parcel: 140,
                    commission_rate: 161.00,
                    exclude_extra_weight_yoyi: 5,
                    extra_weight_commission: 20.00,
                    total_commission: 181.00,
                    addition_refund_15june26: 15.00,
                    addition_pickup_commission: 25.00,
                    nett_commission: 161.00,
                    final_amount_to_pay: 161.00,
                    komisen: 161.00
                },
                {
                    ic_number: "850202085678",
                    name: "Chong Wei Kang",
                    parcel_qty: 200,
                    parcel_yoyi: 15,
                    net_parcel: 185,
                    commission_rate: 212.75,
                    exclude_extra_weight_yoyi: 0,
                    extra_weight_commission: 35.00,
                    total_commission: 247.75,
                    addition_refund_15june26: 0.00,
                    addition_pickup_commission: 50.00,
                    nett_commission: 282.75,
                    final_amount_to_pay: 282.75,
                    komisen: 282.75
                }
            ];
            
            this.tempDeductionRecords = [
                {
                    ic_number: "900101141234",
                    name: "Ahmad Bin Ali",
                    deduction_advance: 50.00,
                    deduction_pending_cod: 0.00,
                    deduction_hq_penalty: 10.00,
                    deduction_duitnow_penalty: 0.00,
                    deduction_late_cod_penalty: 0.00,
                    deduction_lost_individual: 0.00,
                    deduction_lost_parcel_hub: 0.00
                },
                {
                    ic_number: "850202085678",
                    name: "Chong Wei Kang",
                    deduction_advance: 0.00,
                    deduction_pending_cod: 0.00,
                    deduction_hq_penalty: 15.00,
                    deduction_duitnow_penalty: 0.00,
                    deduction_late_cod_penalty: 0.00,
                    deduction_lost_individual: 0.00,
                    deduction_lost_parcel_hub: 0.00
                }
            ];

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
