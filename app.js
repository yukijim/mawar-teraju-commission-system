/**
 * app.js - Main Application Coordinator
 * Bootstraps modules, coordinates visual routing, delegates event triggers,
 * and handles global error trapping.
 */

// Centralized Error Handling System
const ErrorHandler = {
    /**
     * Traps error stack traces, notifies the user via toasts, and writes to IndexedDB log.
     * @param {Error|string} error - The caught exception or description string
     * @param {string} context - Category of code execution that failed
     */
    handle(error, context = 'Sistem') {
        console.error(`[Ralat][${context}]:`, error);
        
        const message = error.message || error.toString() || 'Ralat tidak dijangka berlaku.';
        
        // Attempt to show visual feedback
        if (window.UI) {
            window.UI.showToast('Ralat Sistem', message, 'danger');
        }
        
        // Write to database audit trail if DB connection exists
        if (window.DB && typeof window.DB.log === 'function') {
            window.DB.log(`Ralat (${context})`, message, 'System').catch(dbErr => {
                console.error('Gagal menulis ralat ke log audit database:', dbErr);
            });
        }
    }
};

window.ErrorHandler = ErrorHandler;

// Register global event error catchers
window.addEventListener('error', (e) => {
    ErrorHandler.handle(e.error || e.message, 'Global');
});

window.addEventListener('unhandledrejection', (e) => {
    ErrorHandler.handle(e.reason, 'Promise');
});

// Main Application Namespace
const App = {
    // Current Active View Name
    currentView: 'role-selection',

    // Upload state variables
    selectedFile: null,
    mappedRecords: [],

    /**
     * Bootstraps the application, initializing auth/db modules and the routing system.
     * @returns {Promise<void>}
     */
    async init() {
        console.log('Memulakan Aplikasi Commission Lookup System...');
        
        // Initialize Auth system parameters (checks local hashes etc)
        if (window.Auth) {
            try {
                await window.Auth.initAuth();
            } catch (err) {
                window.ErrorHandler.handle(err, 'Penyediaan Auth');
            }
        }

        // Initialize Database
        if (window.DB) {
            try {
                await window.DB.open();
                console.log('Database Mawar Teraju sedia.');
            } catch (err) {
                window.ErrorHandler.handle(err, 'Penyediaan Database');
            }
        }

        // Initialize Routing & view bindings
        if (window.Router) {
            window.Router.init();
        }

        // Initialize Lucide icons
        this.renderIcons();
    },

    /**
     * Delegates Lucide icons rendering to the UI module.
     */
    renderIcons() {
        if (window.UI) {
            window.UI.renderIcons();
        }
    },

    /**
     * Delegates client-side URL routing trigger to the Router module.
     */
    routeByHash() {
        if (window.Router) {
            window.Router.routeByHash();
        }
    },

    /**
     * Delegates programmatic view transitions to the Router module.
     * @param {string} viewId - Target view name
     */
    navigateTo(viewId) {
        if (window.Router) {
            window.Router.navigateTo(viewId);
        }
    },

    /**
     * Delegates view visibility changes to the Router module.
     * @param {string} viewId - View wrapper ID part
     */
    activateView(viewId) {
        if (window.Router) {
            window.Router.activateView(viewId);
        }
    },

    /**
     * Delegates file upload listener bindings to the Upload module.
     */
    bindUploadEvents() {
        if (window.Upload) {
            window.Upload.bindUploadEvents();
        }
    },

    /**
     * Delegates drag-and-drop or select parse flows to the Upload module.
     * @param {File} file - Selected Excel spreadsheet
     */
    handleFileSelect(file) {
        if (window.Upload) {
            window.Upload.handleFileSelect(file);
        }
    },

    /**
     * Delegates file clear and dashboard reset actions to the Upload module.
     */
    cancelFileSelection() {
        if (window.Upload) {
            window.Upload.cancelFileSelection();
        }
    },

    /**
     * Delegates import commit transactions to the Upload module.
     */
    confirmAndImport() {
        if (window.Upload) {
            window.Upload.confirmAndImport();
        }
    },

    /**
     * Delegates spreadsheet template generation to the Upload module.
     */
    downloadTemplate() {
        if (window.Upload) {
            window.Upload.downloadTemplate();
        }
    },

    /**
     * Delegates simulation spreadsheets generation to the Upload module.
     */
    runTestUpload() {
        if (window.Upload) {
            window.Upload.runTestUpload();
        }
    },

    /**
     * Delegates dashboard stat updates to the Dashboard module.
     */
    loadDashboardStats() {
        if (window.Dashboard) {
            window.Dashboard.loadDashboardStats();
        }
    },

    /**
     * Delegates database wipe confirmation to the Admin module.
     */
    confirmClearDatabase() {
        if (window.Admin) {
            window.Admin.confirmClearDatabase();
        }
    },

    /**
     * Delegates file-specific database rollbacks to the Dashboard module.
     * @param {number} historyId - ID of the upload history entry to delete
     */
    handleRollback(historyId) {
        if (window.Dashboard) {
            window.Dashboard.handleRollback(historyId);
        }
    },

    /**
     * Delegates header action updates to the UI module.
     */
    updateHeaderActions() {
        if (window.UI) {
            window.UI.updateHeaderActions(this.currentView);
        }
    },

    /**
     * Delegates IC input formatter triggers to the Dispatch module.
     */
    bindIcFormatter() {
        if (window.Dispatch) {
            window.Dispatch.bindIcFormatter();
        }
    },

    /**
     * Delegates search reset operations to the Dispatch module.
     */
    resetSearch() {
        if (window.Dispatch) {
            window.Dispatch.resetSearch();
        }
    },

    /**
     * Delegates dispatcher search form submissions to the Dispatch module.
     * @param {Event} event - Form submit event
     */
    handleSearch(event) {
        if (window.Dispatch) {
            window.Dispatch.handleSearch(event);
        }
    },

    /**
     * Delegates administrative backup downloads to the Admin module.
     */
    downloadBackup() {
        if (window.Admin) {
            window.Admin.downloadBackup();
        }
    },

    /**
     * Delegates file restorations to the Admin module.
     * @param {Event} event - Input change event
     */
    handleRestoreBackup(event) {
        if (window.Admin) {
            window.Admin.handleRestoreBackup(event);
        }
    },

    /**
     * Delegates audit modal open prompts to the UI module.
     */
    openAuditModal() {
        if (window.UI) {
            window.UI.openAuditModal();
        }
    },

    /**
     * Delegates audit modal close events to the UI module.
     */
    closeAuditModal() {
        if (window.UI) {
            window.UI.closeAuditModal();
        }
    },

    /**
     * Delegates audit log resets to the Admin module.
     */
    clearSystemAuditLogs() {
        if (window.Admin) {
            window.Admin.clearSystemAuditLogs();
        }
    },

    /**
     * Delegates admin login verifications to the Admin module.
     * @param {Event} event - Submit event
     */
    handleLogin(event) {
        if (window.Admin) {
            window.Admin.handleLogin(event);
        }
    },

    /**
     * Delegates admin session logouts to the Admin module.
     */
    handleLogout() {
        if (window.Admin) {
            window.Admin.handleLogout();
        }
    },

    /**
     * Delegates password updates to the Admin module.
     * @param {Event} event - Submit event
     */
    handleChangePassword(event) {
        if (window.Admin) {
            window.Admin.handleChangePassword(event);
        }
    },

    /**
     * Delegates toast notifications display to the UI module.
     * @param {string} title - Main header of toast
     * @param {string} desc - Main body text
     * @param {'success'|'danger'|'warning'|'info'} type - Visual category
     */
    showToast(title, desc, type = 'info') {
        if (window.UI) {
            window.UI.showToast(title, desc, type);
        }
    },

    /**
     * Delegates password modal opens to the UI module.
     */
    openPasswordModal() {
        if (window.UI) {
            window.UI.openPasswordModal();
        }
    },

    /**
     * Delegates password modal closes to the UI module.
     */
    closePasswordModal() {
        if (window.UI) {
            window.UI.closePasswordModal();
        }
    },

    downloadCommissionReportPDF() {
        if (window.Dispatch) {
            window.Dispatch.downloadCommissionReportPDF();
        }
    },

    downloadDeductionDetailsPDF() {
        if (window.Dispatch) {
            window.Dispatch.downloadDeductionDetailsPDF();
        }
    }
};

// Initialize App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Assign to window for global DOM accessibility
window.App = App;
