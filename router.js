/**
 * router.js - Routing & View Navigation Module
 * Coordinates client-side hash routing, protects authentication boundaries,
 * and handles view transition state.
 */

const Router = {
    // Flag to ensure event listeners are registered only once
    isRoutingInitialized: false,

    /**
     * Initializes the client router and binds hash events.
     */
    init() {
        if (this.isRoutingInitialized) return;

        // Setup routing based on initial URL hash or default
        this.routeByHash();
        window.addEventListener('hashchange', () => this.routeByHash());

        // Bind Logo click
        const logoBtn = window.DomCache.get('logo-btn');
        if (logoBtn) {
            logoBtn.addEventListener('click', () => {
                this.navigateTo('role-selection');
            });
        }

        this.isRoutingInitialized = true;
    },

    /**
     * Resolves the view based on the current window hash state.
     */
    routeByHash() {
        let hash = window.location.hash.substring(1) || 'role-selection';
        
        // Handle route aliases/fallbacks
        if (hash === 'dispatch') {
            hash = 'dispatch-search';
        }
        
        // Protect admin views
        if (hash === 'admin-dashboard') {
            if (!window.Auth || !window.Auth.isAdminLoggedIn()) {
                if (window.UI) {
                    window.UI.showToast('Sekatan Akses', 'Sila log masuk sebagai Admin terlebih dahulu.', 'danger');
                }
                window.location.hash = '#login';
                return;
            }
        }

        this.activateView(hash);
    },

    /**
     * Programmatically navigates to a view using URL hashes.
     * @param {string} viewId - Target view name
     */
    navigateTo(viewId) {
        window.location.hash = `#${viewId}`;
    },

    /**
     * Changes active view in the DOM and coordinates view-specific routines.
     * @param {string} viewId - ID part of the target view
     */
    activateView(viewId) {
        if (window.App) {
            window.App.currentView = viewId;
        }

        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = window.DomCache.get(`${viewId}-view`);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            const fallbackView = window.DomCache.get('role-selection-view');
            if (fallbackView) {
                fallbackView.classList.add('active');
            }
        }

        // Initialize view-specific setups
        if (viewId === 'admin-dashboard') {
            if (window.Dashboard) {
                window.Dashboard.loadDashboardStats();
            }
            if (window.Upload) {
                window.Upload.bindUploadEvents();
            }
        } else if (viewId === 'dispatch-search') {
            if (window.Dispatch) {
                window.Dispatch.bindIcFormatter();
                window.Dispatch.resetSearch();
            }
        }

        // Refresh UI components
        if (window.UI) {
            window.UI.updateHeaderActions(viewId);
            window.UI.renderIcons();
        }
    }
};

window.Router = Router;
