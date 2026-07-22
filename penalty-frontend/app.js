/**
 * app.js - Penalty Portal JavaScript Application
 */

const apiFetch = async function(url, options = {}) {
    options.credentials = 'include';
    const isLocalTesting = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (window.location.port === '9999' || window.location.port === '3000' || window.location.port === '4000' || window.location.port === '8080');
    const baseUrl = isLocalTesting ? 'http://localhost:5000' : '';
    return fetch(baseUrl + url, options);
};

const App = {
    init() {
        if (window.lucide) {
            lucide.createIcons();
        }

        // Check query parameter
        const params = new URLSearchParams(window.location.search);
        const dispatcherId = params.get('dispatcher_id');
        if (dispatcherId) {
            const input = document.getElementById('dispatcher-id-input');
            if (input) input.value = dispatcherId.trim().toUpperCase();
            this.executeSearch(dispatcherId);
        }
    },

    clearSearch() {
        const input = document.getElementById('dispatcher-id-input');
        if (input) input.value = '';
        document.getElementById('results-area').style.display = 'none';
        document.getElementById('empty-area').style.display = 'none';
    },

    async handleSearch(event) {
        event.preventDefault();
        const input = document.getElementById('dispatcher-id-input');
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;
        await this.executeSearch(val);
    },

    async executeSearch(dispatcherId) {
        const resultsArea = document.getElementById('results-area');
        const emptyArea = document.getElementById('empty-area');

        resultsArea.style.display = 'none';
        emptyArea.style.display = 'none';

        try {
            const res = await apiFetch(`/api/v1/penalty/search?dispatcher_id=${encodeURIComponent(dispatcherId.trim().toUpperCase())}`);
            if (!res.ok) {
                const errRes = await res.json().catch(() => ({}));
                throw new Error(errRes.message || 'Ralat pelayan semasa carian.');
            }

            const result = await res.json();
            const records = result.data?.records || [];

            if (records.length === 0) {
                document.getElementById('searched-disp-id').textContent = dispatcherId;
                emptyArea.style.display = 'block';
                return;
            }

            // Populate dispatcher summary
            const name = records[0].delivery_dispatcher_name || 'N/A';
            document.getElementById('dispatcher-name-val').textContent = name;
            document.getElementById('dispatcher-id-val').textContent = dispatcherId.trim().toUpperCase();

            // Calculate totals
            let grandTotal = 0;
            const tableBody = document.getElementById('penalty-table-body');
            tableBody.innerHTML = '';

            records.forEach(r => {
                const fakeReturn = parseFloat(r.fake_return || 0);
                const fakeProblematic = parseFloat(r.fake_problematic || 0);
                const fraudDelivery = parseFloat(r.fraud_delivery || 0);
                const arbitration = parseFloat(r.arbitration || 0);
                const individualLost = parseFloat(r.individual_lost || 0);
                const logic = parseFloat(r.logic || 0);

                const rowTotal = fakeReturn + fakeProblematic + fraudDelivery + arbitration + individualLost + logic;
                grandTotal += rowTotal;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--text-subtitle);">${r.awb}</td>
                    <td style="color: ${fakeReturn > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${fakeReturn > 0 ? 'RM ' + fakeReturn.toFixed(2) : '-'}</td>
                    <td style="color: ${fakeProblematic > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${fakeProblematic > 0 ? 'RM ' + fakeProblematic.toFixed(2) : '-'}</td>
                    <td style="color: ${fraudDelivery > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${fraudDelivery > 0 ? 'RM ' + fraudDelivery.toFixed(2) : '-'}</td>
                    <td style="color: ${arbitration > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${arbitration > 0 ? 'RM ' + arbitration.toFixed(2) : '-'}</td>
                    <td style="color: ${individualLost > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${individualLost > 0 ? 'RM ' + individualLost.toFixed(2) : '-'}</td>
                    <td style="color: ${logic > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">${logic > 0 ? 'RM ' + logic.toFixed(2) : '-'}</td>
                `;
                tableBody.appendChild(tr);
            });

            document.getElementById('total-penalty-val').textContent = `RM ${grandTotal.toFixed(2)}`;
            resultsArea.style.display = 'block';
            if (window.lucide) {
                lucide.createIcons();
            }
        } catch (error) {
            this.showToast('Ralat', error.message || 'Gagal membuat carian denda.', 'danger');
        }
    },

    showToast(title, desc, type) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = type === 'danger' ? 'var(--danger)' : 'var(--success)';
        toast.innerHTML = `
            <strong style="display: block; font-size: 0.9rem; margin-bottom: 0.25rem; color: ${type === 'danger' ? 'var(--danger)' : 'var(--success)'};">${title}</strong>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${desc}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4000);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
