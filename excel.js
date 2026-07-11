/**
 * excel.js - Excel Parsing & Validation Module (Business-First Architecture)
 * Handles parsing of consolidated Excel files, maps columns dynamically,
 * extracts dispatcher-to-IC master mappings, and computes aggregates in JS.
 */

const ExcelParser = {
    // Expected column keys and standard headers mappings
    MAPPING_RULES: {
        dispatcher_id: ['delivery dispatcher id', 'dispatcher id', 'id dispatcher', 'id'],
        name: ['delivery dispatcher name', 'nama', 'name', 'nama penuh', 'fullname', 'full name', 'dispatch'],
        parcel_qty: ['parcel quantity', 'parcel qty', 'bilangan parcel', 'jumlah parcel'],
        net_parcel: ['net parcel'],
        exclude_extra_weight_yoyi: ['exclude extra weight yoyi'],
        commission_rate: ['rm1.11/parcel commission', 'rm1.11 / parcel commission', 'rm1.11/parcel commission', 'commission', 'komisen'],
        diff_rate_new_joiner: ['diff rate new joiner', 'diff rate new joiner '],
        count_pickup: ['count of pick up dispatcher name', 'count of pick up'],
        extra_weight_commission: ['extra weight commission', 'extra weight commission (=>5.01kg, add rm0.10/kg)'],
        total_commission: ['total commission'],
        deduction_advance: ['deduction: advance', 'deduction: advance ', 'deduction advance'],
        deduction_pending_cod: ['deduction: pending cod', 'deduction: pending cod ', 'deduction pending cod'],
        deduction_hq_penalty: ['deduction: hq penalty', 'deduction: hq penalty ', 'deduction hq penalty'],
        deduction_duitnow_penalty: ['deduction: duitnow penalty', 'deduction: duitnow penalty ', 'deduction duitnow penalty'],
        deduction_late_cod_penalty: ['deduction: late cod penalty', 'deduction: late cod penalty ', 'deduction late cod penalty'],
        deduction_lost_individual: ['deduction: lost individual', 'deduction: lost individual ', 'deduction lost individual'],
        deduction_lost_parcel_hub: ['deduction: lost parcel hub', 'deduction: lost parcel hub ', 'deduction lost parcel hub'],
        addition_pickup_commission: ['add: pickup commission', 'addition: pickup commission', 'pickup commission'],
        addition_fuel_allowance: ['add: fuel allowance', 'fuel allowance'],
        addition_sorter: ['add: sorter', 'sorter'],
        nett_commission: ['nett commission', 'net commission'],
        final_amount_to_pay: ['final amount to pay', 'amount to pay'],
        system_reg: ['system reg', 'system reg ', 'system_reg'],
        ic_number: ['count digit', 'no ic', 'no. ic', 'nric', 'ic number', 'ic'],
        parcel_qty_jms: ['parcel qty jms'],
        status_payment: ['status', 'status_payment'],
        date_payment: ['date payment', 'date payment ', 'date_payment'],
        remark: ['remark farisha', 'remark']
    },

    PENALTY_MAPPING_RULES: {
        dispatcher_id: ['delivery dispatcher id', 'dispatcher id', 'id dispatcher', 'id'],
        name: ['delivery dispatcher name', 'nama', 'name', 'nama penuh'],
        lost_pic_signed: ['lost pic signed', 'lost pic signed '],
        lost_rate: ['lost rate'],
        total_all_lost_shared: ['total all lost shared', 'total all lost shared '],
        lost_parcel_pic_signed: ['lost parcel pic signed'],
        arbi_individual: ['arbi individual'],
        rcgen_penalty: ['rcgen 03.07.26', 'rcgen'],
        qc_penalty: ['qc'],
        total_hq_penalty_detail: ['total hq penalty', 'total hq penalty ']
    },

    normalizeHeader(str) {
        if (!str) return '';
        return str.toString()
            .toLowerCase()
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    parseNumericValue(val) {
        if (val === undefined || val === null || val === '') return 0;
        const cleanVal = val.toString().replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleanVal);
        return isNaN(parsed) ? 0 : parsed;
    },

    /**
     * Reads a file and parses it using SheetJS.
     * @param {File} file - Excel file
     * @returns {Promise<Object>} SheetJS Workbook object
     */
    parseFileToWorkbook(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook);
                } catch (error) {
                    console.error('SheetJS parse error:', error);
                    reject(new Error('Format fail Excel tidak boleh dibaca atau rosak.'));
                }
            };
            reader.onerror = () => reject(new Error('Gagal membaca fail.'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Dynamically finds the header row in a worksheet by scanning for "delivery dispatcher id"
     * and returns the converted JSON list of rows starting from that header index.
     * @param {Object} sheet - SheetJS Worksheet
     * @returns {Array<Object>} Rows data
     */
    getSheetRows(sheet) {
        if (!sheet || !sheet['!ref']) return [];
        const range = XLSX.utils.decode_range(sheet['!ref']);
        let headerRowIdx = range.s.r;
        for (let r = range.s.r; r <= range.e.r; r++) {
            let found = false;
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
                const cell = sheet[cellRef];
                if (cell && cell.v && cell.v.toString().toLowerCase().includes('delivery dispatcher id')) {
                    found = true;
                    break;
                }
            }
            if (found) {
                headerRowIdx = r;
                break;
            }
        }
        return XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '' });
    },

    /**
     * Analyzes and validates the sheets for Commission and Penalty details.
     * @param {Object} workbook - SheetJS Workbook object
     * @returns {Object} Validation and mapping results
     */
    validateAndMapWorkbook(workbook) {
        // Find sheets
        const sheetNames = workbook.SheetNames;
        const commSheetName = sheetNames.find(n => n.toLowerCase().includes('dispatcher comm') || n.toLowerCase().includes('comm'));
        const dedSheetName = sheetNames.find(n => n.toLowerCase().includes('penalty') || n.toLowerCase().includes('deduction'));

        if (!commSheetName) {
            return { isValid: false, error: 'Lembaran "Dispatcher Comm" tidak dijumpai dalam fail Excel.' };
        }

        const commSheet = workbook.Sheets[commSheetName];
        const commRows = this.getSheetRows(commSheet);

        if (commRows.length === 0) {
            return { isValid: false, error: 'Sheet "Dispatcher Comm" kosong atau tidak mengandungi data.' };
        }

        // Map commission sheet headers
        const firstCommRow = commRows[0];
        const commOriginalHeaders = Object.keys(firstCommRow);
        const commHeadersMap = {};
        for (const key of Object.keys(this.MAPPING_RULES)) {
            commHeadersMap[key] = null;
        }

        commOriginalHeaders.forEach(header => {
            const cleanHeader = this.normalizeHeader(header);
            for (const [key, aliases] of Object.entries(this.MAPPING_RULES)) {
                if (!commHeadersMap[key] && aliases.includes(cleanHeader)) {
                    commHeadersMap[key] = header;
                    break;
                }
            }
        });

        // Validate required headers for Commission
        const requiredCommKeys = ['dispatcher_id', 'ic_number', 'name'];
        const missingCommFields = [];
        requiredCommKeys.forEach(key => {
            if (!commHeadersMap[key]) {
                missingCommFields.push(key);
            }
        });

        if (missingCommFields.length > 0) {
            return {
                isValid: false,
                error: `Tajuk lajur wajib komisen tidak ditemui: ${missingCommFields.join(', ')}`
            };
        }

        // Initialize maps & lists
        const masterMapping = {}; // dispatcher_id -> { ic_number, name }
        const dispatcherMappingsList = [];
        const commissionRecords = [];

        // 1. Process Commission Records & Build Master Mapping
        commRows.forEach((row) => {
            const rawId = row[commHeadersMap.dispatcher_id];
            const rawIc = row[commHeadersMap.ic_number];
            if (!rawId || rawId.toString().trim() === '') return;

            const dispatcher_id = rawId.toString().trim();
            const cleanIc = rawIc ? rawIc.toString().replace(/[\s-]/g, '') : '';
            const name = row[commHeadersMap.name] ? row[commHeadersMap.name].toString().trim() : '';

            if (cleanIc) {
                masterMapping[dispatcher_id] = { ic_number: cleanIc, name };
                dispatcherMappingsList.push({ dispatcher_id, ic_number: cleanIc, name });
            }

            // Extract numeric fields directly from the pre-calculated workbook cells (Excel is single source of truth)
            const parcel_qty = this.parseNumericValue(row[commHeadersMap.parcel_qty]);
            const net_parcel = this.parseNumericValue(row[commHeadersMap.net_parcel]);
            const exclude_extra_weight_yoyi = this.parseNumericValue(row[commHeadersMap.exclude_extra_weight_yoyi]);
            const commission_rate = this.parseNumericValue(row[commHeadersMap.commission_rate]);
            const diff_rate_new_joiner = this.parseNumericValue(row[commHeadersMap.diff_rate_new_joiner]);
            const count_pickup = this.parseNumericValue(row[commHeadersMap.count_pickup]);
            const extra_weight_commission = this.parseNumericValue(row[commHeadersMap.extra_weight_commission]);
            const total_commission = this.parseNumericValue(row[commHeadersMap.total_commission]);

            const addition_pickup_commission = this.parseNumericValue(row[commHeadersMap.addition_pickup_commission]);
            const addition_fuel_allowance = this.parseNumericValue(row[commHeadersMap.addition_fuel_allowance]);
            const addition_sorter = this.parseNumericValue(row[commHeadersMap.addition_sorter]);

            const deduction_advance = this.parseNumericValue(row[commHeadersMap.deduction_advance]);
            const deduction_pending_cod = this.parseNumericValue(row[commHeadersMap.deduction_pending_cod]);
            const deduction_hq_penalty = this.parseNumericValue(row[commHeadersMap.deduction_hq_penalty]);
            const deduction_duitnow_penalty = this.parseNumericValue(row[commHeadersMap.deduction_duitnow_penalty]);
            const deduction_late_cod_penalty = this.parseNumericValue(row[commHeadersMap.deduction_late_cod_penalty]);
            const deduction_lost_individual = this.parseNumericValue(row[commHeadersMap.deduction_lost_individual]);
            const deduction_lost_parcel_hub = this.parseNumericValue(row[commHeadersMap.deduction_lost_parcel_hub]);

            const nett_commission = this.parseNumericValue(row[commHeadersMap.nett_commission]);
            const final_amount_to_pay = this.parseNumericValue(row[commHeadersMap.final_amount_to_pay]);

            commissionRecords.push({
                dispatcher_id,
                ic_number: cleanIc,
                name,
                parcel_qty,
                net_parcel,
                exclude_extra_weight_yoyi,
                commission_rate,
                diff_rate_new_joiner,
                count_pickup,
                extra_weight_commission,
                total_commission,
                addition_pickup_commission,
                addition_fuel_allowance,
                addition_sorter,
                deduction_advance,
                deduction_pending_cod,
                deduction_hq_penalty,
                deduction_duitnow_penalty,
                deduction_late_cod_penalty,
                deduction_lost_individual,
                deduction_lost_parcel_hub,
                nett_commission,
                final_amount_to_pay,
                system_reg: row[commHeadersMap.system_reg] ? row[commHeadersMap.system_reg].toString().trim() : '',
                parcel_qty_jms: this.parseNumericValue(row[commHeadersMap.parcel_qty_jms]),
                status_payment: row[commHeadersMap.status_payment] ? row[commHeadersMap.status_payment].toString().trim() : 'DRAFT',
                date_payment: row[commHeadersMap.date_payment] ? row[commHeadersMap.date_payment].toString().trim() : '',
                remark: row[commHeadersMap.remark] ? row[commHeadersMap.remark].toString().trim() : ''
            });
        });

        // 2. Process Deduction Records (if Details Penalty exists)
        const deductionRecords = [];
        let detailsPenaltyPresent = false;

        if (dedSheetName) {
            const dedSheet = workbook.Sheets[dedSheetName];
            const dedRows = this.getSheetRows(dedSheet);

            if (dedRows.length > 0) {
                detailsPenaltyPresent = true;
                const firstDedRow = dedRows[0];
                const dedOriginalHeaders = Object.keys(firstDedRow);
                const dedHeadersMap = {};
                for (const key of Object.keys(this.PENALTY_MAPPING_RULES)) {
                    dedHeadersMap[key] = null;
                }

                dedOriginalHeaders.forEach(header => {
                    const cleanHeader = this.normalizeHeader(header);
                    for (const [key, aliases] of Object.entries(this.PENALTY_MAPPING_RULES)) {
                        if (!dedHeadersMap[key] && aliases.includes(cleanHeader)) {
                            dedHeadersMap[key] = header;
                            break;
                        }
                    }
                });

                // Validate details penalty headers
                if (dedHeadersMap.dispatcher_id) {
                    dedRows.forEach((row) => {
                        const rawId = row[dedHeadersMap.dispatcher_id];
                        if (!rawId || rawId.toString().trim() === '') return;

                        const dispatcher_id = rawId.toString().trim();
                        // Resolve IC number via Master Mapping
                        const mapping = masterMapping[dispatcher_id] || { ic_number: '', name: '' };
                        const ic_number = mapping.ic_number;
                        const name = row[dedHeadersMap.name] ? row[dedHeadersMap.name].toString().trim() : mapping.name;

                        const lost_pic_signed = this.parseNumericValue(row[dedHeadersMap.lost_pic_signed]);
                        const lost_rate = this.parseNumericValue(row[dedHeadersMap.lost_rate]);
                        const total_all_lost_shared = this.parseNumericValue(row[dedHeadersMap.total_all_lost_shared]);
                        const lost_parcel_pic_signed = this.parseNumericValue(row[dedHeadersMap.lost_parcel_pic_signed]);
                        const arbi_individual = this.parseNumericValue(row[dedHeadersMap.arbi_individual]);
                        const rcgen_penalty = this.parseNumericValue(row[dedHeadersMap.rcgen_penalty]);
                        const qc_penalty = this.parseNumericValue(row[dedHeadersMap.qc_penalty]);
                        const total_hq_penalty_detail = this.parseNumericValue(row[dedHeadersMap.total_hq_penalty_detail]);

                        // Pull general deductions from commissionRecord if matching
                        const commRec = commissionRecords.find(c => c.dispatcher_id === dispatcher_id) || {};

                        deductionRecords.push({
                            dispatcher_id,
                            ic_number,
                            name,
                            deduction_advance: commRec.deduction_advance || 0,
                            deduction_pending_cod: commRec.deduction_pending_cod || 0,
                            deduction_duitnow_penalty: commRec.deduction_duitnow_penalty || 0,
                            deduction_late_cod_penalty: commRec.deduction_late_cod_penalty || 0,
                            deduction_hq_penalty: total_hq_penalty_detail, // Override from detail
                            deduction_lost_individual: lost_parcel_pic_signed, // Override
                            deduction_lost_parcel_hub: total_all_lost_shared, // Override
                            lost_pic_signed,
                            lost_rate,
                            total_all_lost_shared,
                            lost_parcel_pic_signed,
                            arbi_individual,
                            rcgen_penalty,
                            qc_penalty,
                            total_hq_penalty_detail
                        });
                    });
                }
            }
        }

        // If details penalty is not in workbook, populate deductionRecords from Commission report values
        if (!detailsPenaltyPresent) {
            commissionRecords.forEach(c => {
                deductionRecords.push({
                    dispatcher_id: c.dispatcher_id,
                    ic_number: c.ic_number,
                    name: c.name,
                    deduction_advance: c.deduction_advance,
                    deduction_pending_cod: c.deduction_pending_cod,
                    deduction_duitnow_penalty: c.deduction_duitnow_penalty,
                    deduction_late_cod_penalty: c.deduction_late_cod_penalty,
                    deduction_hq_penalty: c.deduction_hq_penalty,
                    deduction_lost_individual: c.deduction_lost_individual,
                    deduction_lost_parcel_hub: c.deduction_lost_parcel_hub,
                    lost_pic_signed: 0,
                    lost_rate: 0,
                    total_all_lost_shared: c.deduction_lost_parcel_hub,
                    lost_parcel_pic_signed: c.deduction_lost_individual,
                    arbi_individual: 0,
                    rcgen_penalty: 0,
                    qc_penalty: 0,
                    total_hq_penalty_detail: c.deduction_hq_penalty
                });
            });
        }

        return {
            isValid: true,
            commissionRecords,
            deductionRecords,
            dispatcherMappings: dispatcherMappingsList,
            detailsPenaltyPresent
        };
    }
};

window.ExcelParser = ExcelParser;
