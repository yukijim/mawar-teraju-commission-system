/**
 * router.js - Routing & View Navigation Module (Admin frontend)
 */

const Router = {
    isRoutingInitialized: false,

    init() {
        if (this.isRoutingInitialized) return;

        this.routeByHash();
        window.addEventListener('hashchange', () => this.routeByHash());

        // Bind Logo click
        const logoBtn = window.DomCache.get('logo-btn');
        if (logoBtn) {
            logoBtn.addEventListener('click', () => {
                if (window.Auth && window.Auth.isAdminLoggedIn()) {
                    this.navigateTo('admin-dashboard');
                } else {
                    this.navigateTo('login');
                }
            });
        }

        this.isRoutingInitialized = true;
    },

    routeByHash() {
        let hash = window.location.hash.substring(1) || 'login';
        
        // Protect admin views
        if (hash === 'admin-dashboard') {
            if (!window.Auth || !window.Auth.isAdminLoggedIn()) {
                if (window.UI) {
                    window.UI.showToast('Sekatan Akses', 'Sila log masuk sebagai Admin terlebih dahulu.', 'danger');
                }
                window.location.hash = '#login';
                return;
            }
        } else if (hash !== 'login') {
            // Re-route any unrecognized hashes
            window.location.hash = window.Auth && window.Auth.isAdminLoggedIn() ? '#admin-dashboard' : '#login';
            return;
        }

        this.activateView(hash);
    },

    navigateTo(viewId) {
        window.location.hash = `#${viewId}`;
    },

    activateView(viewId) {
        if (window.App) {
            window.App.currentView = viewId;
        }

        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
        });

        const targetView = window.DomCache.get(`${viewId}-view`);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            const fallbackView = window.DomCache.get('login-view');
            if (fallbackView) {
                fallbackView.classList.add('active');
            }
        }

        if (viewId === 'admin-dashboard') {
            if (window.Dashboard) {
                window.Dashboard.loadDashboardStats();
            }
            if (window.Upload) {
                window.Upload.bindUploadEvents();
            }
        }

        if (window.UI) {
            window.UI.updateHeaderActions(viewId);
            window.UI.renderIcons();
        }
    }
};

window.Router = Router;
