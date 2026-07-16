/**
 * app.js - Dispatch Application Coordinator
 * Bootstraps modules, coordinates carian routing, and traps global errors.
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
    currentView: 'dispatch-search',

    /**
     * Bootstraps the application, initializing config/db modules and the routing system.
     * @returns {Promise<void>}
     */
    async init() {
        console.log('Memulakan Aplikasi Commission Lookup...');
        
        // Apply isomorphic white-label configuration values
        if (window.companyConfig) {
            const config = window.companyConfig;
            document.title = `${config.portalName} - Commission Lookup System`;
            
            document.querySelectorAll('img[alt*="Mawar Teraju"]').forEach(img => {
                img.alt = `${config.companyName} Logo`;
            });
            
            const headerTitle = document.querySelector('h2[style*="font-family: \'Outfit\'"]');
            if (headerTitle) headerTitle.textContent = config.companyName.toUpperCase();
            
            const welcomeTitle = document.querySelector('.welcome-title');
            if (welcomeTitle) welcomeTitle.textContent = `${config.companyName} Commission Management System`;
            
            const footerCopy = document.querySelector('footer p');
            if (footerCopy) {
                footerCopy.innerHTML = `&copy; 2026 ${config.companyName}. Hak Cipta Terpelihara. ${config.portalName} Modular.`;
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

        // Initialize Routing & view bindings
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

    // Search logic wrapper
    async handleSearch(event) {
        if (event) event.preventDefault();
        if (window.Dispatch) {
            await window.Dispatch.handleSearch(event);
        }
    },

    resetSearch() {
        if (window.Dispatch) {
            window.Dispatch.resetSearch();
        }
    },

    // PDF triggers
    async downloadCommissionReportPDF() {
        if (window.Dispatch) {
            await window.Dispatch.downloadCommissionReportPDF();
        }
    },

    async downloadDeductionDetailsPDF() {
        if (window.Dispatch) {
            await window.Dispatch.downloadDeductionDetailsPDF();
        }
    }
};

window.App = App;

// Bootstrap on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
