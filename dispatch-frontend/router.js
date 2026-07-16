/**
 * router.js - Routing & View Navigation Module (Dispatch frontend)
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
                this.navigateTo('dispatch-search');
            });
        }

        this.isRoutingInitialized = true;
    },

    routeByHash() {
        let hash = window.location.hash.substring(1) || 'dispatch-search';
        
        // Prevent accessing other views, enforce dispatch-search only
        if (hash !== 'dispatch-search' && hash !== 'dispatch') {
            window.location.hash = '#dispatch-search';
            return;
        }

        this.activateView('dispatch-search');
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

        const targetView = window.DomCache.get('dispatch-search-view');
        if (targetView) {
            targetView.classList.add('active');
        }

        if (window.Dispatch) {
            window.Dispatch.bindIcFormatter();
        }

        if (window.UI) {
            window.UI.updateHeaderActions(viewId);
            window.UI.renderIcons();
        }
    }
};

window.Router = Router;
