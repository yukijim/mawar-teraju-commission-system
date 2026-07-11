# EXCEL MAPPING SPECIFICATION

Dokumen ini memperincikan struktur rasmi, formula, pemetaan data, dan skema pangkalan data yang diekstrak daripada fail rujukan `24-NSN305 DSP COMMISSION JUN 2026 - DRAFT - Copy.xlsx`.

---

## 1. Senarai Sheet & Lajur yang Digunakan

Sistem hanya memaparkan laporan kepada Dispatcher (Rider) menggunakan dua sheet utama sebagai sumber laporan, manakala sheet lain dianggap sebagai data pengiraan dalaman.

### A. Laporan Komisen (Sumber: `Dispatcher Comm`)
*   **Tujuan**: Menjana **Commission Report** ringkasan dan PDF.
*   **Kolum Utama & Jenis Data**:
    1.  `Delivery Dispatcher ID` (Col A) - `String` (ID unik dispatcher, cth: `NSN3052004`)
    2.  `Delivery Dispatcher Name` (Col B) - `String` (Nama penuh dispatcher)
    3.  `Parcel Quantity` (Col C) - `Number` (Jumlah parcel)
    4.  `Net Parcel` (Col D) - `Number` (Parcel bersih pengecualian)
    5.  `Exclude Extra Weight YOYI` (Col E) - `Number` (Parcel untuk komisen berat tambahan)
    6.  `RM1.11/Parcel Commission` (Col F) - `Number` (Komisen asas RM1.11 per parcel)
    7.  `DIFF RATE NEW JOINER ` (Col G) - `Number` (Pelarasan kadar joiner baru)
    8.  `Count of Pick Up Dispatcher Name` (Col H) - `Number` (Kiraan pickup)
    9.  `Extra Weight Commission (=>5.01kg, Add RM0.10/kg)` (Col I) - `Number` (Komisen berat tambahan)
    10. `Total Commission` (Col J) - `Number` (Jumlah kasar komisen)
    11. `DEDUCTION: ADVANCE` (Col L) - `Number` (Potongan pendahuluan)
    12. `DEDUCTION: PENDING COD` (Col M) - `Number` (Potongan COD tertangguh)
    13. `DEDUCTION: HQ PENALTY` (Col N) - `Number` (Potongan denda HQ)
    14. `DEDUCTION: DUITNOW PENALTY` (Col O) - `Number` (Potongan denda DuitNow)
    15. `DEDUCTION: LATE COD PENALTY` (Col P) - `Number` (Potongan denda COD lewat)
    16. `DEDUCTION: LOST INDIVIDUAL` (Col Q) - `Number` (Potongan barang hilang individu)
    17. `DEDUCTION: LOST PARCEL HUB` (Col R) - `Number` (Potongan barang hilang hub)
    18. `ADD: PICKUP COMMISSION` (Col S) - `Number` (Tambahan komisen pickup)
    19. `ADD: FUEL ALLOWANCE` (Col T) - `Number` (Tambahan elaun petrol)
    20. `ADD: SORTER` (Col U) - `Number` (Tambahan elaun sorter)
    21. `NETT COMMISSION` (Col V) - `Number` (Komisen bersih sebelum bundar)
    22. `FINAL AMOUNT TO PAY` (Col W) - `Number` (Jumlah bayaran bersih akhir dibundarkan)
    23. `SYSTEM REG` (Col X) - `String` (Rujukan pendaftaran sistem)
    24. `COUNT DIGIT` (Col Y) - `String` (Nombor IC dispatch)
    25. `PARCEL QTY JMS` (Col Z) - `Number` (Jumlah parcel JMS / panjang IC)
    26. `STATUS` (Col AA) - `String` (Status bayaran)
    27. `DATE PAYMENT` (Col AB) - `String` (Tarikh bayaran)
    28. `REMARK FARISHA` (Col AC) - `String` (Catatan admin)

### B. Perincian Potongan (Sumber: `Details Penalty`)
*   **Tujuan**: Menjana **Deduction Details Report** PDF.
*   **Kolum Utama & Jenis Data**:
    1.  `Delivery Dispatcher ID` (Col A) - `String` (ID unik dispatcher, cth: `NSN3052004`)
    2.  `Delivery Dispatcher Name` (Col B) - `String` (Nama penuh)
    3.  `LOST PIC SIGNED ` (Col C) - `Number` (Potongan lost parcel PIC signed)
    4.  `LOST RATE` (Col D) - `Number` (Potongan kadar lost parcel)
    5.  `TOTAL ALL LOST SHARED` (Col E) - `Number` (Jumlah potongan lost parcel hub)
    6.  `LOST PARCEL PIC SIGNED` (Col H) - `Number` (Potongan lost parcel individu)
    7.  `ARBI INDIVIDUAL` (Col J) - `Number` (Potongan denda ARBI)
    8.  `RCGEN 03.07.26` (Col K) - `Number` (Potongan denda RCGEN)
    9.  `QC` (Col L) - `Number` (Potongan denda QC)
    10. `TOTAL HQ PENALTY` (Col M) - `Number` (Jumlah denda HQ)

### C. Sheet Pengiraan Dalaman (RAW Data - Tidak Dipaparkan)
*   `RAW`: Log data transaksi kasar.
*   `AWB Data`: Senarai AWB dengan `Billing Weight`, `Dispatcher ID`, dan `Extra Weight Commission (New)`.
*   `Agent D Data` / `D Price` / `AWB YOYI` / `Pickup` / `Yoyi` / `Palong` / `Sorter`: Digunakan untuk formula lookup dalaman.

---

## 2. Master Mapping: Hubungan ID Dispatcher ke No. IC

Penting untuk difahami bahawa **Delivery Dispatcher ID** (cth: `NSN3052004`) **bukanlah** Nombor IC.
Hubungan pemetaan diuruskan melalui lajur berikut pada sheet `Dispatcher Comm`:
*   **Kunci Tempatan**: `Delivery Dispatcher ID` (Column A)
*   **No. IC / NRIC**: `COUNT DIGIT` (Column Y) - Diperolehi daripada lookup `[1]Added Bene240425` dalam excel asal.

### Peraturan Pemetaan (Mapping Rules) Semasa Import:
1.  Semasa memuat naik fail Excel, sistem akan mengimbas sheet `Dispatcher Comm` baris-demi-baris.
2.  Sistem membina memori **Master Mapping**: `Delivery Dispatcher ID` $\rightarrow$ `No. IC` (menggunakan nilai dari `COUNT DIGIT` Column Y).
3.  Setiap rekod dalam `commission_records` disimpan dengan `dispatcher_id` dan `ic_number` yang dipetakan.
4.  Semasa memproses sheet `Details Penalty`, rekod tidak mempunyai No. IC secara langsung. Sistem akan mencari `No. IC` berdasarkan `Delivery Dispatcher ID` menggunakan **Master Mapping** yang dibina di Langkah 2 sebelum menyimpannya ke dalam `deduction_records`.
5.  Dispatcher (Rider) hanya boleh mencari data mereka menggunakan **No. IC** (12 digit, tanpa sengkang). Carian akan memaparkan rekod yang dipublikasikan (`status: 'published'`) yang mempunyai `ic_number` sepadan.

---

## 3. Pemetaan Formula-ke-Field (Formula to Code Logic)

Bagi mengelakkan kebergantungan sistem pada formula live Excel, formula berikut akan dikira secara backend/database (JS) semasa proses import dan disimpan sebagai nilai statik:

| Nama Lajur / Field | Formula Excel Asal | Logik JavaScript / Database |
| :--- | :--- | :--- |
| **Exclude Extra Weight YOYI** | `=ParcelQty - NetParcel` | `exclude_extra_weight_yoyi = parcel_qty - net_parcel` |
| **RM1.11/Parcel Commission** | `=ParcelQty * 1.11` | `commission_rate = parcel_qty * 1.11` |
| **Extra Weight Commission** | `=ROUND(SUMIFS('AWB Data'!G:G, 'AWB Data'!D:D, ID), 2) - ExcludeExtraWeightYOYI` | `extra_weight_commission = Math.round((sumOfAwbWeightComm) * 100) / 100 - exclude_extra_weight_yoyi` |
| **Total Commission** | `=RM1.11Comm - DiffRate + ExtraWeightComm` | `total_commission = commission_rate - diff_rate_new_joiner + extra_weight_commission` |
| **DEDUCTION: HQ PENALTY** | `=VLOOKUP(ID, 'Details Penalty'!A:M, 13, FALSE)` | `deduction_hq_penalty` diselaraskan dengan `TOTAL HQ PENALTY` (Col M) dari `Details Penalty` bagi ID yang sama |
| **DEDUCTION: LOST INDIVIDUAL**| `=VLOOKUP(ID, 'Details Penalty'!A:M, 8, FALSE)` | `deduction_lost_individual` diselaraskan dengan `LOST PARCEL PIC SIGNED` (Col H) dari `Details Penalty` |
| **DEDUCTION: LOST PARCEL HUB**| `=VLOOKUP(ID, 'Details Penalty'!A:M, 5, FALSE)` | `deduction_lost_parcel_hub` diselaraskan dengan `TOTAL ALL LOST SHARED` (Col E) dari `Details Penalty` |
| **NETT COMMISSION** | `=TotalComm - Deductions + Additions` | `nett_commission = total_commission - (advance + pending_cod + hq_penalty + duitnow_penalty + late_cod_penalty + lost_individual + lost_parcel_hub) + (pickup_comm + fuel_allowance + sorter)` |
| **FINAL AMOUNT TO PAY** | `=ROUND(NettCommission, 2)` | `final_amount_to_pay = Math.round(nett_commission * 100) / 100` |

---

## 4. Skema Database Baharu (IndexedDB Enhanced Schema)

Skema IndexedDB dinaik taraf ke **Versi 4** dengan penambahan struktur dan metadata berikut.

### A. Store: `batches`
*   Menyimpan fail asal, bulan/tahun batch, dan status `draft` / `published` / `archived`.
*   **Key Path**: `id` (Auto Increment)
*   **Medan**:
    *   `id`: `Number`
    *   `name`: `String` (cth: "Jun 2026")
    *   `status`: `String` (`"draft"` / `"published"` / `"archived"`)
    *   `active`: `Number` (`1` untuk aktif, `0` untuk tidak aktif)
    *   `createdTime`: `Number`
    *   `publishedTime`: `Number`
    *   `fileName`: `String` (Nama fail excel tunggal yang diimport)
    *   `commissionCount`: `Number`
    *   `deductionCount`: `Number`

### B. Store: `commission_records`
*   Menyimpan semua data komisen dari sheet `Dispatcher Comm`.
*   **Key Path**: `id` (Auto Increment)
*   **Index**:
    *   `batchId`
    *   `ic_number`
    *   `dispatcher_id`
    *   `batch_ic` (Composite: `['batchId', 'ic_number']`)
*   **Medan**:
    *   `id`, `batchId`, `ic_number`, `dispatcher_id`, `name`
    *   `parcel_qty`, `net_parcel`, `exclude_extra_weight_yoyi`, `commission_rate` (RM1.11/parcel)
    *   `diff_rate_new_joiner`, `count_pickup`
    *   `extra_weight_commission`, `total_commission`
    *   `addition_pickup_commission`, `addition_fuel_allowance`, `addition_sorter`
    *   `nett_commission`, `final_amount_to_pay`
    *   `system_reg`, `count_digit`, `parcel_qty_jms`
    *   `status_payment` (Col AA), `date_payment` (Col AB), `remark_farisha` (Col AC)

### C. Store: `deduction_records`
*   Menyimpan semua data potongan dispatcher dari `Details Penalty` dan `Dispatcher Comm`.
*   **Key Path**: `id` (Auto Increment)
*   **Index**:
    *   `batchId`
    *   `ic_number`
    *   `dispatcher_id`
    *   `batch_ic` (Composite: `['batchId', 'ic_number']`)
*   **Medan**:
    *   `id`, `batchId`, `ic_number`, `dispatcher_id`, `name`
    *   `deduction_advance`, `deduction_pending_cod`, `deduction_hq_penalty`, `deduction_duitnow_penalty`, `deduction_late_cod_penalty`, `deduction_lost_individual`, `deduction_lost_parcel_hub`
    *   **Perincian Denda HQ & Lost (dari Details Penalty)**:
        *   `lost_pic_signed`
        *   `lost_rate`
        *   `total_all_lost_shared` (lost parcel hub)
        *   `lost_parcel_pic_signed` (lost parcel individual)
        *   `arbi_individual`
        *   `rcgen_penalty`
        *   `qc_penalty`
        *   `total_hq_penalty_detail`

---

## 5. Ujian Regresi & Kes Ujian (Regression Tests)

Bagi mengesahkan integriti pengiraan formula-ke-field dalam JavaScript berbanding fail Excel fizikal, set data contoh dari **MUHAMMAD AMIRUL HAKIM BIN SALEHUDIN** (Dispatcher ID: `NSN3056695`) digunakan sebagai kes ujian regresi utama:

### Kes Ujian 1: Pengiraan Komisen Kasar & Bersih Rider
*   **Input**:
    *   Dispatcher ID: `NSN3052004` (MOHAMAD AZLAN BIN JAAPAR)
    *   No. IC: `920605055111`
*   **Nilai Jangkaan (Expected Values)**:
    *   `Parcel Quantity` = `2335`
    *   `Net Parcel` = `2`
    *   `Exclude Extra Weight YOYI` = `2333`
    *   `RM1.11/Parcel Commission` = `2591.85`
    *   `Extra Weight Commission` = `50.00`
    *   `Total Commission` = `2641.85`
    *   `DEDUCTION: LOST PARCEL HUB` = `10.89` (dari `TOTAL ALL LOST SHARED` = `10.8856` Details Penalty Col E)
    *   `ADD: PICKUP COMMISSION` = `15.30`
    *   `NETT COMMISSION` = `2646.26`
    *   `FINAL AMOUNT TO PAY` = `2646.26`

### Kes Ujian 2: Perincian Potongan & Denda Rider
*   **Input**:
    *   Dispatcher ID: `NSN3052006` (NOORSAYPUL BIN ABDUL RAZAK)
    *   No. IC: `920818055043`
*   **Nilai Jangkaan (Expected Values)**:
    *   `DEDUCTION: HQ PENALTY` = `499.50` (dari Details Penalty `TOTAL HQ PENALTY` Col M)
    *   `LOST PARCEL PIC SIGNED` (Deduction Lost Individual) = `0.00`
    *   `TOTAL ALL LOST SHARED` (Deduction Lost Hub) = `10.89` (Details Penalty Col E value `10.8856` rounded)
    *   `NETT COMMISSION` = `4851.16`
    *   `FINAL AMOUNT TO PAY` = `4851.16`
