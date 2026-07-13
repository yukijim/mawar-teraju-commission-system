/**
 * admin.js - Administrative Operations Module
 * Handles login, logout, password resets, system backups, database restoration,
 * log clearing, and overall configuration.
 */

const Admin = {
    /**
     * Handles login verification and session creation.
     * @param {Event} event - Form submit event
     * @returns {Promise<void>}
     */
    async handleLogin(event) {
        event.preventDefault();
        const pwdInput = window.DomCache.get('admin-password');
        if (!pwdInput) return;

        try {
            const response = await window.Auth.verifyAdminPassword(pwdInput.value);
            const success = typeof response === 'boolean' ? response : (response && response.success);
            if (success) {
                pwdInput.value = '';
                if (window.UI) {
                    window.UI.showToast('Log Masuk Berjaya', 'Selamat kembali ke Panel Pengurusan.', 'success');
                }
                if (window.Router) {
                    window.Router.navigateTo('admin-dashboard');
                }
            } else {
                if (window.UI) {
                    const failMsg = (response && response.message) ? response.message : 'Kata laluan yang anda masukkan salah. Sila cuba lagi.';
                    window.UI.showToast('Gagal Log Masuk', failMsg, 'danger');
                }
                pwdInput.focus();
            }
        } catch (error) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, 'Admin Login');
            }
        }
    },

    /**
     * Handles admin logging out and clearing active session variables.
     */
    handleLogout() {
        if (window.Auth) {
            window.Auth.logoutAdmin();
        }
        if (window.UI) {
            window.UI.showToast('Log Keluar Berjaya', 'Sesi admin anda telah ditamatkan.', 'info');
        }
        if (window.Router) {
            window.Router.navigateTo('role-selection');
        }
    },

    /**
     * Handles admin password updates.
     * @param {Event} event - Form submit event
     * @returns {Promise<void>}
     */
    async handleChangePassword(event) {
        event.preventDefault();
        const oldPwd = window.DomCache.get('old-pwd');
        const newPwd = window.DomCache.get('new-pwd');
        
        if (!oldPwd || !newPwd) return;

        try {
            if (window.Auth) {
                const result = await window.Auth.changeAdminPassword(oldPwd.value, newPwd.value);
                if (result.success) {
                    if (window.UI) {
                        window.UI.showToast('Berjaya!', result.message, 'success');
                        window.UI.closePasswordModal();
                    }
                    oldPwd.value = '';
                    newPwd.value = '';
                } else {
                    if (window.UI) {
                        window.UI.showToast('Ralat!', result.message, 'danger');
                    }
                }
            }
        } catch (error) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, 'Change Password');
            }
        }
    },

    /**
     * Prompts for confirmation and deletes all database records.
     * @returns {Promise<void>}
     */
    async confirmClearDatabase() {
        if (confirm('Amaran: Adakah anda pasti ingin mengosongkan keseluruhan pangkalan data? Semua sejarah muat naik dan rekod komisen akan dipadamkan.')) {
            try {
                if (!window.DB) return;
                
                await window.DB.clearAllRecords();
                
                // Clear history entries too
                const history = await window.DB.getHistory();
                for (const item of history) {
                    await window.DB.deleteHistory(item.id);
                }
                
                await window.DB.log('Kosongkan Pangkalan Data', 'Semua data telah dikosongkan secara manual oleh Admin.', 'Admin');
                
                if (window.UI) {
                    window.UI.showToast('Padam Berjaya', 'Pangkalan data telah dikosongkan.', 'success');
                }
                if (window.Dashboard) {
                    window.Dashboard.loadDashboardStats();
                }
            } catch (error) {
                if (window.ErrorHandler) {
                    window.ErrorHandler.handle(error, 'Clear Database');
                }
            }
        }
    },

    /**
     * Exports entire database store to a JSON backup file.
     * @returns {Promise<void>}
     */
    async downloadBackup() {
        if (!window.DB) return;
        try {
            if (window.UI) {
                window.UI.showToast('Menjana Backup', 'Mengeksport data pangkalan data...', 'info');
            }
            const backupJson = await window.DB.exportBackup();
            
            const blob = new Blob([backupJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `mawar_teraju_commission_backup_${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await window.DB.log('Eksport Backup', 'Database dieksport sebagai fail backup JSON oleh Admin.', 'Admin');
            
            if (window.UI) {
                window.UI.showToast('Backup Berjaya', 'Fail backup telah dimuat turun.', 'success');
            }
        } catch (error) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, 'Download Backup');
            }
        }
    },

    /**
     * Reads a backup JSON file and restores database state.
     * @param {Event} event - Input change event containing the uploaded file
     * @returns {Promise<void>}
     */
    async handleRestoreBackup(event) {
        const file = event.target.files[0];
        if (!file || !window.DB) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonStr = e.target.result;
                
                if (window.UI) {
                    window.UI.showToast('Pemuatan Backup', 'Sedang memulihkan data pangkalan data...', 'info');
                }
                
                await window.DB.restoreBackup(jsonStr);
                await window.DB.log('Import Backup', `Database berjaya dipulihkan menggunakan fail backup "${file.name}".`, 'Admin');
                
                if (window.UI) {
                    window.UI.showToast('Restore Berjaya', 'Semua data dan konfigurasi telah berjaya dipulihkan.', 'success');
                }
                
                // Clear input
                event.target.value = '';
                
                if (window.Dashboard) {
                    window.Dashboard.loadDashboardStats();
                }
            } catch (error) {
                event.target.value = '';
                if (window.ErrorHandler) {
                    window.ErrorHandler.handle(error, 'Restore Backup');
                }
            }
        };

        reader.onerror = () => {
            event.target.value = '';
            if (window.UI) {
                window.UI.showToast('Membaca Fail Gagal', 'Gagal membuka fail backup.', 'danger');
            }
        };

        reader.readAsText(file);
    },

    /**
     * Clears all system audit logs.
     * @returns {Promise<void>}
     */
    async clearSystemAuditLogs() {
        if (!window.DB) return;
        if (confirm('Adakah anda pasti ingin mengosongkan semua data log audit? Tindakan ini tidak boleh diundur.')) {
            try {
                await window.DB.clearAuditLogs();
                await window.DB.log('Padam Log Audit', 'Semua log audit dibuang secara manual oleh Admin.', 'Admin');
                
                if (window.UI) {
                    window.UI.showToast('Padam Berjaya', 'Semua log audit telah dikosongkan.', 'success');
                    // Refresh logs inside the open modal
                    window.UI.openAuditModal();
                }
            } catch (error) {
                if (window.ErrorHandler) {
                    window.ErrorHandler.handle(error, 'Clear Audit Logs');
                }
            }
        }
    }
};

window.Admin = window.Admin || Admin;
