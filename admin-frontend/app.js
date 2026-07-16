/**
 * app.js - Admin Application Coordinator
 * Bootstraps modules, coordinates authentication, dashboard view transitions,
 * and traps global errors.
 */

// Centralized Error Handling System
const ErrorHandler = {
    handle(error, context = 'Sistem') {
        console.error(`[Ralat][${context}]:`, error);
        const message = error.message || error.toString() || 'Ralat tidak dijangka berlaku.';
        if (window.UI) {
            window.UI.showToast('Ralat Sistem', message, 'danger');
        }
        if (window.DB && typeof window.DB.log === 'function') {
            window.DB.log(`Ralat (${context})`, message, 'System').catch(dbErr => {
                console.error('Gagal menulis ralat ke log audit database:', dbErr);
            });
        }
    }
};

window.ErrorHandler = ErrorHandler;

window.addEventListener('error', (e) => {
    ErrorHandler.handle(e.error || e.message, 'Global');
});

window.addEventListener('unhandledrejection', (e) => {
    ErrorHandler.handle(e.reason, 'Promise');
});

// Main Application Namespace
const App = {
    // Current Active View Name
    currentView: 'login',

    // Upload state variables
    selectedFile: null,
    mappedRecords: [],

    /**
     * Bootstraps the application, initializing config/auth/db modules and routing.
     * @returns {Promise<void>}
     */
    async init() {
        console.log('Memulakan Aplikasi Portal Pentadbir...');
        
        // Apply isomorphic white-label configuration values
        if (window.companyConfig) {
            const config = window.companyConfig;
            document.title = `${config.portalName} Portal Pentadbir`;
            
            document.querySelectorAll('img[alt*="Mawar Teraju"]').forEach(img => {
                img.alt = `${config.companyName} Logo`;
            });
            
            const headerTitle = document.querySelector('h2[style*="font-family: \'Outfit\'"]');
            if (headerTitle) headerTitle.textContent = config.companyName.toUpperCase();
            
            const footerCopy = document.querySelector('footer p');
            if (footerCopy) {
                footerCopy.innerHTML = `&copy; 2026 ${config.companyName}. Hak Cipta Terpelihara. ${config.portalName} Modular.`;
            }
        }
        
        // Initialize Auth system parameters
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
                console.log("Database sedia.");
            } catch (err) {
                window.ErrorHandler.handle(err, 'Penyediaan Database');
            }
        }

        // Initialize Routing
        if (window.Router) {
            window.Router.init();
        }

        // Initialize Lucide icons
        this.renderIcons();
    },

    renderIcons() {
        if (window.UI) {
            window.UI.renderIcons();
        }
    },

    routeByHash() {
        if (window.Router) {
            window.Router.routeByHash();
        }
    },

    navigateTo(viewId) {
        if (window.Router) {
            window.Router.navigateTo(viewId);
        }
    },

    // Auth handlers
    async handleLogin(event) {
        if (event) event.preventDefault();
        if (window.Admin) {
            await window.Admin.handleLogin(event);
        }
    },

    handleLogout() {
        if (window.Admin) {
            window.Admin.handleLogout();
        }
    },

    // Password overlay modals
    openPasswordModal() {
        if (window.UI) window.UI.openPasswordModal();
    },

    closePasswordModal() {
        if (window.UI) window.UI.closePasswordModal();
    },

    async handleChangePassword(event) {
        if (event) event.preventDefault();
        if (window.Admin) {
            await window.Admin.handleChangePassword(event);
        }
    },

    // Audit logs modal
    openAuditModal() {
        if (window.UI) window.UI.openAuditModal();
    },

    closeAuditModal() {
        if (window.UI) window.UI.closeAuditModal();
    },

    async clearSystemAuditLogs() {
        if (window.Admin) {
            await window.Admin.clearSystemAuditLogs();
        }
    },

    // Backup & Restore
    async downloadBackup() {
        if (window.Admin) {
            await window.Admin.downloadBackup();
        }
    },

    async handleRestoreBackup(event) {
        if (window.Admin) {
            await window.Admin.restoreBackup(event);
        }
    },

    async confirmClearDatabase() {
        if (window.Admin) {
            await window.Admin.clearDatabase();
        }
    },

    // Dashboard loading delegates
    async loadDashboardStats() {
        if (window.Dashboard) {
            await window.Dashboard.loadDashboardStats();
        }
    }
};

window.App = App;

// Bootstrap on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
