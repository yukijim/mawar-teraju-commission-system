/**
 * ui.js - User Interface Module (Admin frontend)
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
        if (!headerActions) return;

        headerActions.innerHTML = ''; // Clear default

        if (currentView === 'admin-dashboard') {
            headerActions.innerHTML = `
                <span class="user-badge" style="margin-right: 0.5rem; cursor: pointer;" onclick="App.openPasswordModal()">
                    <i data-lucide="shield"></i> Admin
                </span>
                <button class="btn btn-secondary" onclick="App.handleLogout()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                    Log Keluar
                </button>
            `;
        }
        this.renderIcons();
    },

    openPasswordModal() {
        const modal = DomCache.get('password-modal');
        if (modal) {
            modal.classList.add('active');
        }
    },

    closePasswordModal() {
        const modal = DomCache.get('password-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

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
    const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
    const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
    return fetch(baseUrl + url, options);
};
