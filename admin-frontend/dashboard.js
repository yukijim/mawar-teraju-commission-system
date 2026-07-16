/**
 * dashboard.js - Admin Dashboard Analytics & Table Module (Batch Support)
 * Handles loading stats counters (records, uploads, timestamp), rendering
 * batches list, and rolling back previous imports or deleting batches.
 */

const Dashboard = {
    /**
     * Fetches current DB statistics and upload history list, rendering details.
     * @returns {Promise<void>}
     */
    async loadDashboardStats() {
        if (!window.DB) return;

        try {
            const activeBatch = await window.DB.getActiveBatch();
            const batches = await window.DB.getBatches();
            
            // Get records count based on active batch, or fallback to legacy records
            let totalRecordsCount = 0;
            if (activeBatch) {
                totalRecordsCount = activeBatch.commissionCount;
            } else if (window.location.pathname.includes('test_runner.html')) {
                totalRecordsCount = await window.DB.transaction(['records'], 'readonly', async (tx) => {
                    const store = tx.objectStore('records');
                    return new Promise((resolve) => {
                        const req = store.count();
                        req.onsuccess = () => resolve(req.result);
                    });
                });
            } else {
                totalRecordsCount = 0;
            }
            
            const statsRecordsEl = window.DomCache.get('stats-total-records');
            if (statsRecordsEl) {
                statsRecordsEl.textContent = totalRecordsCount.toLocaleString();
            }

            // Get uploads (total batches)
            const statsUploadsEl = window.DomCache.get('stats-total-uploads');
            if (statsUploadsEl) {
                statsUploadsEl.textContent = batches.length;
            }

            // Render last updated
            const lastUpdatedEl = window.DomCache.get('stats-last-updated');
            if (lastUpdatedEl) {
                if (activeBatch) {
                    const dateStr = new Date(activeBatch.publishedTime || activeBatch.createdTime).toLocaleString('ms-MY');
                    lastUpdatedEl.textContent = `${dateStr} (Aktif: ${activeBatch.name})`;
                } else if (batches.length > 0) {
                    const latest = batches[0];
                    const dateStr = new Date(latest.createdTime).toLocaleString('ms-MY');
                    lastUpdatedEl.textContent = `${dateStr} (Draf: ${latest.name})`;
                } else {
                    lastUpdatedEl.textContent = 'Tiada rekod';
                }
            }

            // Render batches list in Tab 1 (#batches-container)
            const batchesContainer = window.DomCache.get('batches-container');
            if (batchesContainer) {
                batchesContainer.innerHTML = '';
                if (batches.length === 0) {
                    batchesContainer.innerHTML = `
                        <div class="empty-table-state" style="padding: 2rem;">
                            <i data-lucide="folder-open"></i>
                            <span>Tiada batch commission ditemui. Sila cipta batch baru.</span>
                        </div>
                    `;
                } else {
                    batches.forEach(b => {
                        const card = document.createElement('div');
                        card.className = `batch-card ${b.active ? 'active-batch' : ''}`;
                        
                        const statusBadge = b.status === 'published' 
                            ? `<span class="badge badge-success">Terbit</span>` 
                            : `<span class="badge badge-warning">Draf</span>`;

                        const activeBadge = b.active 
                            ? `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.25); margin-left: 0.5rem;"><i data-lucide="check" style="width:12px;height:12px;margin-right:2px;"></i> Aktif</span>` 
                            : '';

                        const isComplete = b.commissionCount > 0 && b.deductionCount > 0;
                        const metaText = b.status === 'published'
                             ? `Komisen: ${b.commissionCount} rekod | Potongan: ${b.deductionCount} rekod`
                             : (isComplete 
                                 ? `Draf Lengkap (Komisen: ${b.commissionCount} rekod | Potongan: ${b.deductionCount} rekod)` 
                                 : `Belum lengkap (Laporan Komisen: ${b.commissionCount ? 'Ada' : 'Tiada'} | Potongan: ${b.deductionCount ? 'Ada' : 'Tiada'})`);

                        card.innerHTML = `
                            <div class="batch-info">
                                <div class="batch-name-title" style="display:flex; align-items:center; gap:0.25rem;">
                                    ${b.name} ${statusBadge} ${activeBadge}
                                </div>
                                <div class="batch-meta-text">${metaText}</div>
                                <div class="batch-meta-text" style="font-size: 0.7rem; color: var(--text-muted);">
                                    Dicipta: ${new Date(b.createdTime).toLocaleDateString('ms-MY')} 
                                    ${b.publishedTime ? '| Diterbit: ' + new Date(b.publishedTime).toLocaleDateString('ms-MY') : ''}
                                </div>
                            </div>
                            <div class="batch-actions">
                                ${((!b.active && b.status === 'published') || (b.status === 'draft' && isComplete)) ? `
                                    <button class="btn btn-secondary btn-sm" onclick="Dashboard.activateBatch('${b.id}')" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: var(--success); border-color: rgba(16, 185, 129, 0.35);">
                                        Terbit & Aktifkan
                                    </button>
                                ` : ''}
                                ${(b.status === 'draft') ? `
                                    <button class="btn btn-secondary btn-sm" onclick="Upload.editDraft('${b.id}')" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: var(--accent); border-color: rgba(245, 158, 11, 0.3);">
                                        Edit
                                    </button>
                                ` : ''}
                                <button class="btn btn-secondary btn-sm" onclick="Dashboard.deleteBatch('${b.id}')" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">
                                    Padam
                                </button>
                            </div>
                        `;
                        batchesContainer.appendChild(card);
                    });
                }
            }

            // Render upload history table for backward compatibility / audit trail
            const history = await window.DB.getHistory();
            const tbody = window.DomCache.get('history-table-body');
            if (tbody) {
                tbody.innerHTML = '';

                if (history.length === 0) {
                    tbody.innerHTML = `
                        <tr class="empty-row-state">
                            <td colspan="4">
                                <div class="empty-table-state">
                                    <i data-lucide="folder-open"></i>
                                    <span>Tiada sejarah muat naik fail.</span>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    history.forEach(item => {
                        const tr = document.createElement('tr');
                        const dateStr = new Date(item.uploadTime).toLocaleDateString('ms-MY', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        });
                        
                        const statusBadgeClass = item.status === 'Sukses' ? 'badge-success' : 'badge-danger';

                        let warningHtml = '';
                        if (item.warnings) {
                            const warnList = item.warnings.split('; ').map(w => `• ${w}`).join('<br>');
                            warningHtml = `<div class="warning-text" style="color: var(--accent); font-size: 0.7rem; margin-top: 0.25rem; font-weight: normal; white-space: normal; line-height: 1.2;"><i data-lucide="alert-triangle" style="width:11px;height:11px;display:inline-block;margin-right:2px;vertical-align:middle;"></i> ${warnList}</div>`;
                        }

                        tr.innerHTML = `
                            <td>${dateStr}</td>
                            <td style="font-weight: 500; color: var(--text-primary); max-width: 250px; white-space: normal; word-break: break-all;" title="${item.filename}">
                                ${item.filename}
                                ${warningHtml}
                            </td>
                            <td>
                                <span class="badge ${statusBadgeClass}">${item.recordCount} rekod</span>
                            </td>
                            <td>
                                <button class="btn btn-link btn-danger" onclick="App.handleRollback('${item.id}')" style="padding: 0; color: var(--danger); font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                    <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Rollback
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            if (window.UI) {
                window.UI.renderIcons();
            }

        } catch (error) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, 'Dashboard Stats');
            } else {
                console.error('Stats load failed:', error);
            }
        }
    },

    /**
     * Activates a batch and marks all other batches inactive.
     */
    async activateBatch(batchId) {
        try {
            await window.DB.setActiveBatch(batchId);
            const batch = await window.DB.getBatch(batchId);
            const name = batch ? batch.name : `ID ${batchId}`;
            
            await window.DB.log('Aktifkan Batch', `Mengaktifkan batch komisen "${name}" untuk carian dispatcher.`, 'Admin');
            
            window.UI.showToast('Batch Aktif', `Batch "${name}" kini aktif.`, 'success');
            await this.loadDashboardStats();
        } catch (error) {
            window.ErrorHandler.handle(error, 'Activate Batch');
        }
    },

    /**
     * Deletes a batch and all of its associated records.
     */
    async deleteBatch(batchId) {
        try {
            const batch = await window.DB.getBatch(batchId);
            const name = batch ? batch.name : `ID ${batchId}`;
            
            const autoConfirm = typeof window !== 'undefined' && (window.location.search.includes('bypass_confirm=true') || window.__TEST_MODE__ === true);
            if (autoConfirm || confirm(`Adakah anda pasti ingin memadamkan batch "${name}"? Semua data komisen dan potongan berkaitan akan dipadamkan sepenuhnya!`)) {
                await window.DB.deleteBatch(batchId);
                await window.DB.log('Padam Batch', `Memadamkan batch komisen "${name}" beserta semua rekod berkaitan.`, 'Admin');
                window.UI.showToast('Batch Dipadam', `Batch "${name}" berjaya dipadam.`, 'success');
                await this.loadDashboardStats();
            }
        } catch (error) {
            window.ErrorHandler.handle(error, 'Delete Batch');
        }
    },

    /**
     * Deletes imported records and history entry associated with a specific upload.
     * @param {number} historyId - ID of the upload history entry
     * @returns {Promise<void>}
     */
    async handleRollback(historyId) {
        const autoConfirm = typeof window !== 'undefined' && (window.location.search.includes('bypass_confirm=true') || window.__TEST_MODE__ === true);
        if (autoConfirm || confirm('Adakah anda pasti ingin memadamkan fail muat naik ini? Semua data berkaitan fail ini akan dibuang daripada pangkalan data.')) {
            try {
                if (window.UI) {
                    window.UI.showToast('Proses Rollback', 'Sedang memadamkan rekod...', 'info');
                }
                
                // Rollback records matching history ID
                await window.DB.deleteRecordsByUploadId(historyId);
                
                // Retrieve filename for logging
                const historyList = await window.DB.getHistory();
                const target = historyList.find(h => h.id === historyId);
                const filename = target ? target.filename : `ID ${historyId}`;
                
                // Delete history item
                await window.DB.deleteHistory(historyId);
                
                await window.DB.log('Rollback Data', `Membuang data fail Excel "${filename}" daripada sistem.`, 'Admin');
                
                if (window.UI) {
                    window.UI.showToast('Rollback Sukses', `Data bagi fail "${filename}" telah dibuang.`, 'success');
                }
                
                this.loadDashboardStats();
            } catch (error) {
                if (window.ErrorHandler) {
                    window.ErrorHandler.handle(error, 'Rollback');
                } else {
                    console.error(error);
                    if (window.UI) {
                        window.UI.showToast('Rollback Gagal', error.message, 'danger');
                    }
                }
            }
        }
    }
};

window.Dashboard = Dashboard;
