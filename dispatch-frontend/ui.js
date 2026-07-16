/**
 * ui.js - User Interface Module (Dispatch frontend)
 */

const DomCache = {
    elements: {},
    get(id) {
        if (!this.elements[id]) {
            this.elements[id] = document.getElementById(id);
        }
        return this.elements[id];
    }
};

const UI = {
    renderIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    showToast(title, desc, type = 'info') {
        const container = DomCache.get('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'danger') iconName = 'alert-triangle';
        if (type === 'warning') iconName = 'alert-circle';

        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${desc}</div>
            </div>
        `;

        container.appendChild(toast);
        this.renderIcons();

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    },

    updateHeaderActions(currentView) {
        const headerActions = DomCache.get('header-actions-area');
        if (headerActions) {
            headerActions.innerHTML = ''; // No header actions in dispatcher view
        }
    }
};

window.UI = UI;
window.DomCache = DomCache;

window.apiFetch = async function(url, options = {}) {
    options.credentials = 'include';
    const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
    const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
    return fetch(baseUrl + url, options);
};
