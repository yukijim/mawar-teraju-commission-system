/**
 * ui.js - User Interface Module
 * Handles visual updates, toasts, modals, icon rendering, and caches DOM selectors.
 */

const DomCache = {
    elements: {},
    /**
     * Retrieves an element from the cache or DOM.
     * @param {string} id - The ID of the DOM element
     * @returns {HTMLElement|null} The cached or newly queried DOM element
     */
    get(id) {
        if (!this.elements[id]) {
            this.elements[id] = document.getElementById(id);
        }
        return this.elements[id];
    }
};

const UI = {
    /**
     * Renders/Refreshes Lucide icons across the DOM.
     */
    renderIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Displays a temporary notification (toast) on the screen.
     * @param {string} title - Main header of toast
     * @param {string} desc - Main body text
     * @param {'success'|'danger'|'warning'|'info'} type - Visual category
     */
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

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    },

    /**
     * Updates header items depending on roles/states.
     * @param {string} currentView - The current active view name
     */
    updateHeaderActions(currentView) {
        const headerActions = DomCache.get('header-actions-area');
        if (!headerActions) return;

        headerActions.innerHTML = ''; // Clear default

        if (currentView === 'admin-dashboard') {
            headerActions.innerHTML = `
                <span class="user-badge" style="margin-right: 0.5rem;">
                    <i data-lucide="shield"></i> Admin
                </span>
                <button class="btn btn-secondary" onclick="App.handleLogout()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                    Log Keluar
                </button>
            `;
        } else if (currentView === 'dispatch-search') {
            headerActions.innerHTML = `
                <button class="btn btn-secondary" onclick="App.navigateTo('role-selection')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                    Utama
                </button>
            `;
        } else if (currentView === 'login') {
            headerActions.innerHTML = `
                <button class="btn btn-secondary" onclick="App.navigateTo('role-selection')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                    Kembali
                </button>
            `;
        }
        this.renderIcons();
    },

    /**
     * Opens Password Modal.
     */
    openPasswordModal() {
        const modal = DomCache.get('password-modal');
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Closes Password Modal.
     */
    closePasswordModal() {
        const modal = DomCache.get('password-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Opens Audit Log modal, fetches and renders records.
     * @returns {Promise<void>}
     */
    async openAuditModal() {
        const modal = DomCache.get('audit-modal');
        if (!modal || !window.DB) return;

        modal.classList.add('active');
        this.showToast('Memuatkan Log', 'Memuatkan aktiviti log audit terbaharu...', 'info');

        try {
            const logs = await window.DB.getLogs();
            const tbody = DomCache.get('audit-table-body');
            if (tbody) {
                tbody.innerHTML = '';

                if (logs.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                                Tiada rekod log audit dalam pangkalan data.
                            </td>
                        </tr>
                    `;
                } else {
                    logs.forEach(log => {
                        const tr = document.createElement('tr');
                        const timeStr = new Date(log.timestamp).toLocaleString('ms-MY');
                        
                        let badgeColorStyle = 'background: rgba(255,255,255,0.05); color: var(--text-secondary);';
                        if (log.user === 'Admin') badgeColorStyle = 'background: rgba(16, 185, 129, 0.1); color: var(--primary);';
                        if (log.user === 'Dispatch') badgeColorStyle = 'background: rgba(59, 130, 246, 0.1); color: var(--info);';

                        tr.innerHTML = `
                            <td>${timeStr}</td>
                            <td>
                                <span class="badge" style="${badgeColorStyle}">${log.user}</span>
                            </td>
                            <td style="font-weight: 600; color: var(--text-primary);">${log.action}</td>
                            <td style="color: var(--text-secondary);">${log.details}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            this.renderIcons();
        } catch (error) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(error, 'Audit Load');
            } else {
                console.error('Audit load failed:', error);
                this.showToast('Ralat Audit', 'Gagal memuatkan rekod log.', 'danger');
            }
        }
    },

    /**
     * Closes Audit Log modal.
     */
    closeAuditModal() {
        const modal = DomCache.get('audit-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

window.UI = UI;
window.DomCache = DomCache;

window.apiFetch = async function(url, options = {}) {
    options.credentials = 'include';
    const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '9999';
    const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
    return fetch(baseUrl + url, options);
};
