/**
 * db.js - IndexedDB Database Module (Version 4 with Repository/Service Abstraction)
 * Implements a clean repository/service pattern to decouple storage implementation
 * from visual presentation and core business rules.
 */

const DB_NAME = 'MawarTerajuCommissionDB';
const DB_VERSION = 8;

const STORES = {
    RECORDS: 'records', // Legacy
    HISTORY: 'history',
    AUDIT_LOG: 'audit_log',
    BATCHES: 'batches',
    COMMISSION_RECORDS: 'commission_records',
    DEDUCTION_RECORDS: 'deduction_records',
    DISPATCHER_MAPPINGS: 'dispatcher_mappings'
};

/**
 * Low-level IndexedDB Database Connection Manager.
 */
class IndexedDBManager {
    constructor() {
        if (!window.location.pathname.includes('test_runner.html')) {
            throw new Error('Restricted: IndexedDBManager cannot be instantiated in production.');
        }
        this.db = null;
    }

    open() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB v' + DB_VERSION + ' dibuka dengan jaya.');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const tx = event.currentTarget.transaction;
                console.log(`IndexedDB memerlukan migrasi dari versi ${oldVersion} ke ${DB_VERSION}...`);

                // 1. Records Store (Legacy/Fallback)
                if (!db.objectStoreNames.contains(STORES.RECORDS)) {
                    const recordStore = db.createObjectStore(STORES.RECORDS, { keyPath: 'ic_number' });
                    recordStore.createIndex('ic_number', 'ic_number', { unique: true });
                    recordStore.createIndex('uploadId', 'uploadId', { unique: false });
                }

                // 2. Upload History Store
                if (!db.objectStoreNames.contains(STORES.HISTORY)) {
                    db.createObjectStore(STORES.HISTORY, { keyPath: 'id', autoIncrement: true });
                }

                // 3. Audit Log Store
                if (!db.objectStoreNames.contains(STORES.AUDIT_LOG)) {
                    const logStore = db.createObjectStore(STORES.AUDIT_LOG, { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 4. Batches Store
                if (!db.objectStoreNames.contains(STORES.BATCHES)) {
                    const batchStore = db.createObjectStore(STORES.BATCHES, { keyPath: 'id', autoIncrement: true });
                    batchStore.createIndex('active', 'active', { unique: false });
                }

                // 5. Commission Records Store
                if (!db.objectStoreNames.contains(STORES.COMMISSION_RECORDS)) {
                    const commStore = db.createObjectStore(STORES.COMMISSION_RECORDS, { keyPath: 'id', autoIncrement: true });
                    commStore.createIndex('batchId', 'batchId', { unique: false });
                    commStore.createIndex('ic_number', 'ic_number', { unique: false });
                    commStore.createIndex('dispatcher_id', 'dispatcher_id', { unique: false });
                    commStore.createIndex('batch_ic', ['batchId', 'ic_number'], { unique: false });
                } else {
                    const store = tx.objectStore(STORES.COMMISSION_RECORDS);
                    if (!store.indexNames.contains('dispatcher_id')) {
                        store.createIndex('dispatcher_id', 'dispatcher_id', { unique: false });
                    }
                    if (!store.indexNames.contains('batch_ic')) {
                        store.createIndex('batch_ic', ['batchId', 'ic_number'], { unique: false });
                    }
                }

                // 6. Deduction Records Store
                if (!db.objectStoreNames.contains(STORES.DEDUCTION_RECORDS)) {
                    const dedStore = db.createObjectStore(STORES.DEDUCTION_RECORDS, { keyPath: 'id', autoIncrement: true });
                    dedStore.createIndex('batchId', 'batchId', { unique: false });
                    dedStore.createIndex('ic_number', 'ic_number', { unique: false });
                    dedStore.createIndex('dispatcher_id', 'dispatcher_id', { unique: false });
                    dedStore.createIndex('batch_ic', ['batchId', 'ic_number'], { unique: false });
                } else {
                    const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
                    if (!store.indexNames.contains('dispatcher_id')) {
                        store.createIndex('dispatcher_id', 'dispatcher_id', { unique: false });
                    }
                    if (!store.indexNames.contains('batch_ic')) {
                        store.createIndex('batch_ic', ['batchId', 'ic_number'], { unique: false });
                    }
                }

                // 7. Dispatcher Mappings Store (V4 New)
                if (!db.objectStoreNames.contains(STORES.DISPATCHER_MAPPINGS)) {
                    const mapStore = db.createObjectStore(STORES.DISPATCHER_MAPPINGS, { keyPath: 'dispatcher_id' });
                    mapStore.createIndex('ic_number', 'ic_number', { unique: false });
                    console.log('Store "dispatcher_mappings" dicipta.');
                } else {
                    const mapStore = tx.objectStore(STORES.DISPATCHER_MAPPINGS);
                    if (mapStore.indexNames.contains('ic_number')) {
                        const index = mapStore.index('ic_number');
                        if (index.unique) {
                            mapStore.deleteIndex('ic_number');
                            mapStore.createIndex('ic_number', 'ic_number', { unique: false });
                        }
                    } else {
                        mapStore.createIndex('ic_number', 'ic_number', { unique: false });
                    }
                }
            };
        });
    }

    async transaction(storeNames, mode, callback) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, mode);
            callback(tx)
                .then(result => {
                    tx.oncomplete = () => resolve(result);
                })
                .catch(err => {
                    tx.abort();
                    reject(err);
                });

            tx.onerror = (event) => reject(event.target.error);
        });
    }
}

/**
 * Base Abstract Repository Interface (for documentation & validation).
 */
class CommissionRepository {
    // Batch operations
    async getBatch(batchId) {}
    async getBatches() {}
    async createBatch(name, status) {}
    async updateBatch(batch) {}
    async getActiveBatch() {}
    async setActiveBatch(batchId) {}
    async deleteBatch(batchId) {}

    // Record retrieval & search
    async getCommissionRecord(batchId, ic) {}
    async getDeductionRecord(batchId, ic) {}
    async getBatchStats(batchId) {}
    async searchByIc(rawIc) {}

    // Record import
    async importCommissionRecords(batchId, list) {}
    async importDeductionRecords(batchId, list) {}
    async deleteCommissionRecordsByBatchId(batchId) {}
    async deleteDeductionRecordsByBatchId(batchId) {}

    // Mappings
    async getDispatcherMapping(dispatcherId) {}
    async importDispatcherMappings(list) {}

    // Transactional Batch Save
    async saveBatchData(batchId, batchMeta, commissionList, deductionList, mappingList) {}
}

/**
 * Repository implementation for client-side IndexedDB storage.
 */
class IndexedDBRepository extends CommissionRepository {
    constructor() {
        super();
        if (!window.location.pathname.includes('test_runner.html')) {
            throw new Error('Restricted: IndexedDBRepository cannot be instantiated in production.');
        }
        this.manager = new IndexedDBManager();
    }

    async getBatch(batchId) {
        return this.manager.transaction([STORES.BATCHES], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            return new Promise((resolve, reject) => {
                const req = store.get(batchId);
                req.onsuccess = (e) => resolve(e.target.result || null);
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async getBatches() {
        return this.manager.transaction([STORES.BATCHES], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            return new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = (e) => {
                    const results = e.target.result || [];
                    results.sort((a, b) => b.id - a.id);
                    resolve(results);
                };
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async createBatch(name, status = 'draft') {
        const batch = {
            name,
            status,
            active: 0,
            createdTime: Date.now(),
            publishedTime: null,
            commissionFilename: '',
            deductionFilename: '',
            commissionCount: 0,
            deductionCount: 0
        };
        // Parse Month and Year from batch name
        const match = name.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-zA-Z]*\s*(\d{4})$/i);
        if (match) {
            const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
            batch.month = months[match[1].toLowerCase()];
            batch.year = parseInt(match[2]);
        } else {
            const d = new Date();
            batch.month = d.getMonth() + 1;
            batch.year = d.getFullYear();
        }

        return this.manager.transaction([STORES.BATCHES], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            return new Promise((resolve, reject) => {
                const req = store.add(batch);
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async updateBatch(batch) {
        return this.manager.transaction([STORES.BATCHES], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            return new Promise((resolve, reject) => {
                const req = store.put(batch);
                req.onsuccess = () => resolve();
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async getActiveBatch() {
        return this.manager.transaction([STORES.BATCHES], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            const index = store.index('active');
            return new Promise((resolve, reject) => {
                const req = index.get(1);
                req.onsuccess = (e) => {
                    const result = e.target.result;
                    // Double check status is published
                    if (result && result.status === 'published') {
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async setActiveBatch(batchId) {
        return this.manager.transaction([STORES.BATCHES], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.BATCHES);
            return new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = (e) => {
                    const batches = e.target.result || [];
                    for (const b of batches) {
                        b.active = (b.id === batchId) ? 1 : 0;
                        store.put(b);
                    }
                    resolve();
                };
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async deleteBatch(batchId) {
        return this.manager.transaction([
            STORES.BATCHES,
            STORES.COMMISSION_RECORDS,
            STORES.DEDUCTION_RECORDS
        ], 'readwrite', async (tx) => {
            const batchStore = tx.objectStore(STORES.BATCHES);
            const commStore = tx.objectStore(STORES.COMMISSION_RECORDS);
            const dedStore = tx.objectStore(STORES.DEDUCTION_RECORDS);

            batchStore.delete(batchId);

            // Cascade delete commission records
            const commIndex = commStore.index('batchId');
            commIndex.openCursor(IDBKeyRange.only(batchId)).onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            // Cascade delete deduction records
            const dedIndex = dedStore.index('batchId');
            dedIndex.openCursor(IDBKeyRange.only(batchId)).onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
        });
    }

    async getCommissionRecord(batchId, ic) {
        return this.manager.transaction([STORES.COMMISSION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.COMMISSION_RECORDS);
            const index = store.index('batch_ic');
            return new Promise((resolve, reject) => {
                const request = index.get([batchId, ic]);
                request.onsuccess = (e) => resolve(e.target.result || null);
                request.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async getDeductionRecord(batchId, ic) {
        return this.manager.transaction([STORES.DEDUCTION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
            const index = store.index('batch_ic');
            return new Promise((resolve, reject) => {
                const request = index.get([batchId, ic]);
                request.onsuccess = (e) => resolve(e.target.result || null);
                request.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async importCommissionRecords(batchId, list) {
        return this.manager.transaction([STORES.COMMISSION_RECORDS], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.COMMISSION_RECORDS);
            let count = 0;
            for (const r of list) {
                const record = { ...r, batchId };
                if (record.ic_number) {
                    record.ic_number = record.ic_number.toString().replace(/[\s-]/g, '');
                }
                store.put(record);
                count++;
            }
            return count;
        });
    }

    async importDeductionRecords(batchId, list) {
        return this.manager.transaction([STORES.DEDUCTION_RECORDS], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
            let count = 0;
            for (const r of list) {
                const record = { ...r, batchId };
                if (record.ic_number) {
                    record.ic_number = record.ic_number.toString().replace(/[\s-]/g, '');
                }
                store.put(record);
                count++;
            }
            return count;
        });
    }

    async deleteCommissionRecordsByBatchId(batchId) {
        return this.manager.transaction([STORES.COMMISSION_RECORDS], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.COMMISSION_RECORDS);
            const index = store.index('batchId');
            return new Promise((resolve, reject) => {
                const request = index.openCursor(IDBKeyRange.only(batchId));
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    async deleteDeductionRecordsByBatchId(batchId) {
        return this.manager.transaction([STORES.DEDUCTION_RECORDS], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
            const index = store.index('batchId');
            return new Promise((resolve, reject) => {
                const request = index.openCursor(IDBKeyRange.only(batchId));
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    async getBatchStats(batchId) {
        const commCount = await this.manager.transaction([STORES.COMMISSION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.COMMISSION_RECORDS);
            const index = store.index('batchId');
            return new Promise((resolve) => {
                const req = index.count(IDBKeyRange.only(batchId));
                req.onsuccess = () => resolve(req.result);
            });
        });
        const dedCount = await this.manager.transaction([STORES.DEDUCTION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
            const index = store.index('batchId');
            return new Promise((resolve) => {
                const req = index.count(IDBKeyRange.only(batchId));
                req.onsuccess = () => resolve(req.result);
            });
        });
        return { commission: commCount, deduction: dedCount };
    }

    async getCommissionRecordByDispatcherId(batchId, dispatcherId) {
        return this.manager.transaction([STORES.COMMISSION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.COMMISSION_RECORDS);
            const index = store.index('dispatcher_id');
            return new Promise((resolve, reject) => {
                const request = index.openCursor(IDBKeyRange.only(dispatcherId));
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.batchId === batchId) {
                            resolve(cursor.value);
                        } else {
                            cursor.continue();
                        }
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async getDeductionRecordByDispatcherId(batchId, dispatcherId) {
        return this.manager.transaction([STORES.DEDUCTION_RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.DEDUCTION_RECORDS);
            const index = store.index('dispatcher_id');
            return new Promise((resolve, reject) => {
                const request = index.openCursor(IDBKeyRange.only(dispatcherId));
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.batchId === batchId) {
                            resolve(cursor.value);
                        } else {
                            cursor.continue();
                        }
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async searchByIc(rawIc) {
        const cleanIc = rawIc.toString().replace(/[\s-]/g, '');
        if (!cleanIc) return [];

        const activeBatch = await this.getActiveBatch();
        if (activeBatch) {
            const isId = /[a-zA-Z]/.test(cleanIc);
            let commission = null;
            let deduction = null;

            if (isId) {
                commission = await this.getCommissionRecordByDispatcherId(activeBatch.id, cleanIc);
                deduction = await this.getDeductionRecordByDispatcherId(activeBatch.id, cleanIc);
            } else {
                commission = await this.getCommissionRecord(activeBatch.id, cleanIc);
                deduction = await this.getDeductionRecord(activeBatch.id, cleanIc);
            }

            if (!commission && !deduction) return [];

            // Perform client side join of commission and deduction records
            const merged = {
                ic_number: commission ? commission.ic_number : (deduction ? deduction.ic_number : cleanIc),
                dispatcher_id: commission ? commission.dispatcher_id : (deduction ? deduction.dispatcher_id : ''),
                name: commission ? commission.name : (deduction ? deduction.name : ''),
                batchId: activeBatch.id,
                
                // Commission & allowance
                parcel_qty: commission ? commission.parcel_qty : 0,
                net_parcel: commission ? commission.net_parcel : 0,
                exclude_extra_weight_yoyi: commission ? commission.exclude_extra_weight_yoyi : 0,
                commission_rate: commission ? commission.commission_rate : 0,
                diff_rate_new_joiner: commission ? commission.diff_rate_new_joiner : 0,
                count_pickup: commission ? commission.count_pickup : 0,
                extra_weight_commission: commission ? commission.extra_weight_commission : 0,
                total_commission: commission ? commission.total_commission : 0,
                addition_pickup_commission: commission ? commission.addition_pickup_commission : 0,
                addition_fuel_allowance: commission ? commission.addition_fuel_allowance : 0,
                addition_sorter: commission ? commission.addition_sorter : 0,
                nett_commission: commission ? commission.nett_commission : 0,
                final_amount_to_pay: commission ? commission.final_amount_to_pay : 0,
                
                // General deductions
                deduction_advance: deduction ? deduction.deduction_advance : 0,
                deduction_pending_cod: deduction ? deduction.deduction_pending_cod : 0,
                deduction_hq_penalty: deduction ? deduction.deduction_hq_penalty : 0,
                deduction_duitnow_penalty: deduction ? deduction.deduction_duitnow_penalty : 0,
                deduction_late_cod_penalty: deduction ? deduction.deduction_late_cod_penalty : 0,
                deduction_lost_individual: deduction ? deduction.deduction_lost_individual : 0,
                deduction_lost_parcel_hub: deduction ? deduction.deduction_lost_parcel_hub : 0,

                // Detailed penalty items (Details Penalty sheet)
                lost_pic_signed: deduction ? deduction.lost_pic_signed : 0,
                lost_rate: deduction ? deduction.lost_rate : 0,
                total_all_lost_shared: deduction ? deduction.total_all_lost_shared : 0,
                lost_parcel_pic_signed: deduction ? deduction.lost_parcel_pic_signed : 0,
                arbi_individual: deduction ? deduction.arbi_individual : 0,
                rcgen_penalty: deduction ? deduction.rcgen_penalty : 0,
                qc_penalty: deduction ? deduction.qc_penalty : 0,
                total_hq_penalty_detail: deduction ? deduction.total_hq_penalty_detail : 0,

                commissionFilename: activeBatch.commissionFilename || '',
                deductionFilename: activeBatch.deductionFilename || '',
                batchName: activeBatch.name
            };

            // Backward compatibility
            merged.icNumber = merged.ic_number;
            merged.nama = merged.name;
            merged.komisen = merged.final_amount_to_pay;

            return [merged];
        }

        // Fallback to legacy
        return this.manager.transaction([STORES.RECORDS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.RECORDS);
            return new Promise((resolve, reject) => {
                const request = store.get(cleanIc);
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    if (result) {
                        result.icNumber = result.ic_number;
                        result.nama = result.name;
                        result.komisen = result.final_amount_to_pay || 0;
                    }
                    resolve(result ? [result] : []);
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    async getDispatcherMapping(dispatcherId) {
        return this.manager.transaction([STORES.DISPATCHER_MAPPINGS], 'readonly', async (tx) => {
            const store = tx.objectStore(STORES.DISPATCHER_MAPPINGS);
            return new Promise((resolve, reject) => {
                const req = store.get(dispatcherId);
                req.onsuccess = (e) => resolve(e.target.result || null);
                req.onerror = (e) => reject(e.target.error);
            });
        });
    }

    async importDispatcherMappings(list) {
        return this.manager.transaction([STORES.DISPATCHER_MAPPINGS], 'readwrite', async (tx) => {
            const store = tx.objectStore(STORES.DISPATCHER_MAPPINGS);
            for (const item of list) {
                store.put({
                    dispatcher_id: item.dispatcher_id,
                    ic_number: item.ic_number.toString().replace(/[\s-]/g, ''),
                    name: item.name,
                    last_updated: Date.now()
                });
            }
        });
    }

    async log(action, details, user = 'System') {
        if (this.manager) {
            const logItem = { timestamp: Date.now(), action, details, user };
            try {
                return await this.manager.transaction([STORES.AUDIT_LOG], 'readwrite', async (tx) => {
                    const store = tx.objectStore(STORES.AUDIT_LOG);
                    return new Promise((resolve, reject) => {
                        const request = store.add(logItem);
                        request.onsuccess = (e) => resolve(e.target.result);
                        request.onerror = (e) => reject(e.target.error);
                    });
                });
            } catch (error) {
                console.error('Audit logging failed:', error);
                return -1;
            }
        }
        return 0;
    }

    async getLogs() {
        if (this.manager) {
            return this.manager.transaction([STORES.AUDIT_LOG], 'readonly', async (tx) => {
                const store = tx.objectStore(STORES.AUDIT_LOG);
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = (e) => {
                        const results = e.target.result || [];
                        results.sort((a, b) => b.timestamp - a.timestamp);
                        resolve(results);
                    };
                    request.onerror = (e) => reject(e.target.error);
                });
            });
        }
        return [];
    }

    async clearAuditLogs() {
        if (this.manager) {
            return this.manager.transaction([STORES.AUDIT_LOG], 'readwrite', async (tx) => {
                const store = tx.objectStore(STORES.AUDIT_LOG);
                return new Promise((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = (e) => reject(e.target.error);
                });
            });
        }
        return true;
    }

    async addHistory(historyItem) {
        if (this.manager) {
            return this.manager.transaction([STORES.HISTORY], 'readwrite', async (tx) => {
                const store = tx.objectStore(STORES.HISTORY);
                return new Promise((resolve, reject) => {
                    const request = store.add(historyItem);
                    request.onsuccess = (e) => resolve(e.target.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            });
        }
        return null;
    }

    async deleteHistory(historyId) {
        if (this.manager) {
            return this.manager.transaction([STORES.HISTORY], 'readwrite', async (tx) => {
                const store = tx.objectStore(STORES.HISTORY);
                return new Promise((resolve, reject) => {
                    const request = store.delete(historyId);
                    request.onsuccess = () => resolve();
                    request.onerror = (e) => reject(e.target.error);
                });
            });
        }
        return true;
    }

    async exportBackup() {
        if (this.manager) {
            const backup = {
                version: DB_VERSION,
                exportedAt: Date.now(),
                history: [],
                records: [],
                audit_log: []
            };
            return this.manager.transaction([STORES.HISTORY, STORES.RECORDS, STORES.AUDIT_LOG], 'readonly', async (tx) => {
                backup.history = await new Promise((res, rej) => {
                    const req = tx.objectStore(STORES.HISTORY).getAll();
                    req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
                });
                backup.records = await new Promise((res, rej) => {
                    const req = tx.objectStore(STORES.RECORDS).getAll();
                    req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
                });
                backup.audit_log = await new Promise((res, rej) => {
                    const req = tx.objectStore(STORES.AUDIT_LOG).getAll();
                    req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error);
                });
                return JSON.stringify(backup);
            });
        }
        return '';
    }

    async restoreBackup(jsonString) {
        if (this.manager) {
            let backup = JSON.parse(jsonString);
            return this.manager.transaction([STORES.HISTORY, STORES.RECORDS, STORES.AUDIT_LOG], 'readwrite', async (tx) => {
                await tx.objectStore(STORES.HISTORY).clear();
                await tx.objectStore(STORES.RECORDS).clear();
                await tx.objectStore(STORES.AUDIT_LOG).clear();
                for (const h of backup.history) tx.objectStore(STORES.HISTORY).add(h);
                for (const r of backup.records) tx.objectStore(STORES.RECORDS).put(r);
                for (const l of backup.audit_log) tx.objectStore(STORES.AUDIT_LOG).add(l);
            });
        }
        return true;
    }

    // Helper legacy methods
    async clearAllRecords() {
        return this.manager.transaction([
            STORES.RECORDS,
            STORES.BATCHES,
            STORES.COMMISSION_RECORDS,
            STORES.DEDUCTION_RECORDS,
            STORES.HISTORY,
            STORES.DISPATCHER_MAPPINGS
        ], 'readwrite', async (tx) => {
            tx.objectStore(STORES.RECORDS).clear();
            tx.objectStore(STORES.BATCHES).clear();
            tx.objectStore(STORES.COMMISSION_RECORDS).clear();
            tx.objectStore(STORES.DEDUCTION_RECORDS).clear();
            tx.objectStore(STORES.HISTORY).clear();
            tx.objectStore(STORES.DISPATCHER_MAPPINGS).clear();
        });
    }

    async saveBatchData(batchId, batchMeta, commissionList, deductionList, mappingList) {
        return this.manager.transaction([
            STORES.BATCHES,
            STORES.COMMISSION_RECORDS,
            STORES.DEDUCTION_RECORDS,
            STORES.DISPATCHER_MAPPINGS
        ], 'readwrite', async (tx) => {
            const batchStore = tx.objectStore(STORES.BATCHES);
            const commStore = tx.objectStore(STORES.COMMISSION_RECORDS);
            const dedStore = tx.objectStore(STORES.DEDUCTION_RECORDS);
            const mapStore = tx.objectStore(STORES.DISPATCHER_MAPPINGS);

            // 1. Put Batch Metadata
            await new Promise((resolve, reject) => {
                const req = batchStore.put(batchMeta);
                req.onsuccess = resolve; req.onerror = () => reject(req.error);
            });

            // 2. Clear old commission records for this batch
            const commIndex = commStore.index('batchId');
            await new Promise((resolve, reject) => {
                const req = commIndex.openCursor(IDBKeyRange.only(batchId));
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // 3. Import commission records
            for (const r of commissionList) {
                const record = { ...r, batchId };
                commStore.put(record);
            }

            // 4. Clear old deduction records for this batch
            const dedIndex = dedStore.index('batchId');
            await new Promise((resolve, reject) => {
                const req = dedIndex.openCursor(IDBKeyRange.only(batchId));
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // 5. Import deduction records
            for (const r of deductionList) {
                const record = { ...r, batchId };
                dedStore.put(record);
            }

            // 6. Import dispatcher mappings
            for (const item of mappingList) {
                mapStore.put({
                    dispatcher_id: item.dispatcher_id,
                    ic_number: item.ic_number.toString().replace(/[\s-]/g, ''),
                    name: item.name,
                    last_updated: Date.now()
                });
            }
        });
    }
}

/**
 * Service orchestrating commission batch data logic, delegating database calls.
 * Can switch repository implementation dynamically (swappable PostgreSQL/IndexedDB).
 */
function parsePeriodFromName(name) {
    const monthsMy = {
        'januari': 1, 'februari': 2, 'mac': 3, 'april': 4, 'mei': 5, 'jun': 6,
        'julai': 7, 'ogos': 8, 'september': 9, 'oktober': 10, 'november': 11, 'disember': 12
    };
    const monthsEn = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
    };

    const clean = name.toLowerCase().trim();
    const yearMatch = clean.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    let month = 0;
    for (const [mName, mVal] of Object.entries(monthsMy)) {
        if (clean.includes(mName)) {
            month = mVal;
            break;
        }
    }

    if (month === 0) {
        for (const [mName, mVal] of Object.entries(monthsEn)) {
            if (clean.includes(mName)) {
                month = mVal;
                break;
            }
        }
    }

    if (month === 0) {
        month = new Date().getMonth() + 1;
    }

    return { month, year };
}

function groupAndMergeBatches(rawHistory) {
    const grouped = {};
    rawHistory.forEach(b => {
        const key = b.name;
        if (!grouped[key]) {
            grouped[key] = {
                id: b.id,
                name: b.name,
                month: b.month,
                year: b.year,
                createdTime: new Date(b.created_at || b.uploaded_at).getTime(),
                publishedTime: b.published_at ? new Date(b.published_at).getTime() : null,
                commissionFilename: '',
                deductionFilename: '',
                commissionCount: 0,
                deductionCount: 0,
                commissionBatchId: null,
                deductionBatchId: null
            };
        }
        
        const g = grouped[key];
        const isPublished = b.status === 'PUBLISHED';
        const isActive = !!(b.active || b.is_active);

        if (b.type === 'COMMISSION') {
            g.commissionFilename = b.filename;
            g.commissionCount = b.record_count;
            g.commissionBatchId = b.id;
            g.id = b.id;
        } else if (b.type === 'DEDUCTION') {
            g.deductionFilename = b.filename;
            g.deductionCount = b.record_count;
            g.deductionBatchId = b.id;
            if (!g.id) g.id = b.id;
        }

        if (isPublished) {
            g.status = 'published';
        } else if (!g.status) {
            g.status = 'draft';
        }

        if (isActive) {
            g.active = 1;
        } else if (g.active === undefined) {
            g.active = 0;
        }
    });
    return Object.values(grouped);
}

/**
 * Repository implementation for production PostgreSQL backend REST API.
 */
class PostgresRestRepository extends CommissionRepository {
    async getBatch(batchId) {
        try {
            const res = await window.apiFetch(`/api/v1/upload/${batchId}`);
            if (!res.ok) return null;
            const result = await res.json();
            return result.data?.batch || null;
        } catch (e) {
            return null;
        }
    }

    async getBatches() {
        try {
            const res = await window.apiFetch('/api/v1/upload/history');
            if (!res.ok) return [];
            const result = await res.json();
            const rawHistory = result.data?.history || [];
            return groupAndMergeBatches(rawHistory);
        } catch (e) {
            console.error('[DB] Gagal mendapatkan senarai batch:', e);
            return [];
        }
    }

    async createBatch(name, status) {
        return null;
    }

    async updateBatch(batch) {
        return null;
    }

    async getActiveBatch() {
        const batches = await this.getBatches();
        return batches.find(b => b.active) || null;
    }

    async setActiveBatch(batchId) {
        const batches = await this.getBatches();
        const logicalBatch = batches.find(b => b.commissionBatchId === batchId || b.deductionBatchId === batchId || b.id === batchId);
        
        if (logicalBatch) {
            if (logicalBatch.commissionBatchId) {
                await window.apiFetch(`/api/v1/upload/publish/${logicalBatch.commissionBatchId}`, {
                    method: 'POST'
                });
            }
            if (logicalBatch.deductionBatchId) {
                await window.apiFetch(`/api/v1/upload/publish/${logicalBatch.deductionBatchId}`, {
                    method: 'POST'
                });
            }
            return true;
        }
        await window.apiFetch(`/api/v1/upload/publish/${batchId}`, {
            method: 'POST'
        });
        return true;
    }

    async deleteBatch(batchId) {
        const res = await window.apiFetch(`/api/v1/upload/rollback/${batchId}`, {
            method: 'POST'
        });
        return res.ok;
    }

    async getCommissionRecord(batchId, ic) { return null; }
    async getDeductionRecord(batchId, ic) { return null; }
    async getBatchStats(batchId) { return null; }

    async searchByIc(rawIc) {
        const cleanIc = rawIc.toString().replace(/[\s-]/g, '');
        if (!cleanIc) return [];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const isId = /[a-zA-Z]/.test(cleanIc);
            const queryParam = isId ? `dispatcher_id=${cleanIc}` : `ic_number=${cleanIc}`;
            const response = await window.apiFetch(`/api/v1/search?${queryParam}`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errResult = await response.json().catch(() => ({}));
                throw new Error(errResult.message || `Ralat pelayan (Kod: ${response.status}).`);
            }

            const result = await response.json().catch(() => null);
            if (!result || !result.data || !Array.isArray(result.data.records)) {
                throw new Error('Format maklumat dari pelayan tidak sah.');
            }

            const recordsList = result.data.records;
            if (recordsList.length === 0) {
                return [];
            }

            return recordsList.map(item => {
                const info = item.dispatcherInfo || {};
                const comm = item.commission || {};
                const ded = item.deduction || {};
                const net = item.netAmount || {};
                const batch = item.batchInfo || {};

                return {
                    commission_record_id: comm.id || '',
                    deduction_record_id: ded.id || '',
                    ic_number: info.icNumber || cleanIc,
                    dispatcher_id: info.dispatcherId || '',
                    name: info.name || '',
                    batchName: batch.batchName || '',
                    
                    parcel_qty: comm.parcelQty || 0,
                    net_parcel: comm.netParcel || 0,
                    exclude_extra_weight_yoyi: comm.excludeExtraWeightYoyi || 0,
                    commission_rate: comm.commissionRate || 0,
                    diff_rate_new_joiner: comm.diffRateNewJoiner || 0,
                    count_pickup: comm.countPickup || 0,
                    extra_weight_commission: comm.extraWeightCommission || 0,
                    total_commission: comm.totalCommission || 0,
                    addition_pickup_commission: comm.additionPickupCommission || 0,
                    addition_fuel_allowance: comm.additionFuelAllowance || 0,
                    addition_sorter: comm.additionSorter || 0,
                    nett_commission: net.nettCommission || 0,
                    final_amount_to_pay: net.finalAmountToPay || 0,
                    system_reg: comm.systemReg || '',
                    parcel_qty_jms: comm.parcelQtyJms || 0,
                    status_payment: comm.statusPayment || 'SUCCESS',
                    date_payment: comm.datePayment || '',
                    remark: comm.remark || '',

                    deduction_advance: ded.deductionAdvance || 0,
                    deduction_pending_cod: ded.deductionPendingCod || 0,
                    deduction_hq_penalty: ded.deductionHqPenalty || 0,
                    deduction_duitnow_penalty: ded.deductionDuitnowPenalty || 0,
                    deduction_late_cod_penalty: ded.deductionLateCodPenalty || 0,
                    deduction_lost_individual: ded.deductionLostIndividual || 0,
                    deduction_lost_parcel_hub: ded.deductionLostParcelHub || 0,

                    lost_pic_signed: ded.lostPicSigned || 0,
                    lost_rate: ded.lostRate || 0,
                    total_all_lost_shared: ded.totalAllLostShared || 0,
                    lost_parcel_pic_signed: ded.lostParcelPicSigned || 0,
                    arbi_individual: ded.arbiIndividual || 0,
                    rcgen_penalty: ded.rcgenPenalty || 0,
                    qc_penalty: ded.qcPenalty || 0,
                    total_hq_penalty_detail: ded.totalHqPenaltyDetail || 0
                };
            });
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Sesi sambungan tamat (Request Timeout).');
            }
            console.error('[DB] Ralat semasa carian IC ke API:', error);
            throw error;
        }
    }

    async searchByIC(rawIc) { return this.searchByIc(rawIc); }

    async importCommissionRecords(batchId, list) { return { success: true }; }
    async importDeductionRecords(batchId, list) { return { success: true }; }
    async deleteCommissionRecordsByBatchId(batchId) { return true; }
    async deleteDeductionRecordsByBatchId(batchId) { return true; }

    async getDispatcherMapping(dispatcherId) { return null; }
    async importDispatcherMappings(list) { return { success: true }; }
    async saveBatchData(batchId, batchMeta, commissionList, deductionList, mappingList) {
        return { success: true };
    }

    async getHistory() {
        try {
            const res = await window.apiFetch('/api/v1/upload/history');
            if (!res.ok) return [];
            const result = await res.json();
            const rawHistory = result.data?.history || [];
            return rawHistory.map(b => ({
                id: b.id,
                filename: b.filename,
                recordCount: b.record_count,
                uploadTime: new Date(b.created_at || b.uploaded_at).getTime(),
                status: 'Sukses',
                warnings: b.warnings
            }));
        } catch (e) {
            return [];
        }
    }

    async deleteRecordsByUploadId(historyId) {
        const res = await window.apiFetch(`/api/v1/upload/rollback/${historyId}`, {
            method: 'POST'
        });
        if (!res.ok) {
            const errResult = await res.json().catch(() => ({}));
            throw new Error(errResult.message || 'Gagal melakukan rollback batch.');
        }
        return true;
    }
}

/**
 * Service orchestrating commission batch data logic, delegating database calls.
 * Can switch repository implementation dynamically (swappable PostgreSQL/IndexedDB).
 */
class CommissionService {
    constructor(repository) {
        this.repository = repository;
    }

    setRepository(repository) {
        this.repository = repository;
    }

    async open() {
        if (this.repository.manager && typeof this.repository.manager.open === 'function') {
            return this.repository.manager.open();
        }
    }

    async transaction(storeNames, mode, callback) {
        if (this.repository.manager && typeof this.repository.manager.transaction === 'function') {
            return this.repository.manager.transaction(storeNames, mode, callback);
        }
    }

    async getBatch(batchId) { return this.repository.getBatch(batchId); }
    async getBatches() { return this.repository.getBatches(); }
    async createBatch(name, status) { return this.repository.createBatch(name, status); }
    async updateBatch(batch) { return this.repository.updateBatch(batch); }
    async getActiveBatch() { return this.repository.getActiveBatch(); }
    async setActiveBatch(batchId) { return this.repository.setActiveBatch(batchId); }
    async deleteBatch(batchId) { return this.repository.deleteBatch(batchId); }

    async getCommissionRecord(batchId, ic) { return this.repository.getCommissionRecord(batchId, ic); }
    async getDeductionRecord(batchId, ic) { return this.repository.getDeductionRecord(batchId, ic); }
    async getBatchStats(batchId) { return this.repository.getBatchStats(batchId); }
    async searchByIc(rawIc) { return this.repository.searchByIc(rawIc); }
    async searchByIC(rawIc) { return this.searchByIc(rawIc); }

    async importCommissionRecords(batchId, list) { return this.repository.importCommissionRecords(batchId, list); }
    async importDeductionRecords(batchId, list) { return this.repository.importDeductionRecords(batchId, list); }
    async deleteCommissionRecordsByBatchId(batchId) { return this.repository.deleteCommissionRecordsByBatchId(batchId); }
    async deleteDeductionRecordsByBatchId(batchId) { return this.repository.deleteDeductionRecordsByBatchId(batchId); }

    async getDispatcherMapping(dispatcherId) { return this.repository.getDispatcherMapping(dispatcherId); }
    async importDispatcherMappings(list) { return this.repository.importDispatcherMappings(list); }
    async saveBatchData(batchId, batchMeta, commissionList, deductionList, mappingList) {
        return this.repository.saveBatchData(batchId, batchMeta, commissionList, deductionList, mappingList);
    }

    async addHistory(historyItem) { return this.repository.addHistory ? this.repository.addHistory(historyItem) : null; }
    async getHistory() { return this.repository.getHistory(); }
    async deleteHistory(historyId) { return this.repository.deleteHistory ? this.repository.deleteHistory(historyId) : true; }
    async deleteRecordsByUploadId(historyId) { return this.repository.deleteRecordsByUploadId(historyId); }

    async log(action, details, user = 'System') {
        console.log(`[Audit Log] ${action}: ${details} (User: ${user})`);
        return this.repository.log ? this.repository.log(action, details, user) : 0;
    }

    async getLogs() { return this.repository.getLogs ? this.repository.getLogs() : []; }
    async clearAuditLogs() { return this.repository.clearAuditLogs ? this.repository.clearAuditLogs() : true; }

    async clearAllRecords() { return this.repository.clearAllRecords ? this.repository.clearAllRecords() : true; }

    async exportBackup() { return this.repository.exportBackup ? this.repository.exportBackup() : ''; }
    async restoreBackup(jsonString) { return this.repository.restoreBackup ? this.repository.restoreBackup(jsonString) : true; }
}

// Instantiate swappable repository based on page environment
const isTestRunner = typeof window !== 'undefined' && window.__TEST_MODE__ === true;
const repository = isTestRunner ? new IndexedDBRepository() : new PostgresRestRepository();
window.DB = new CommissionService(repository);
