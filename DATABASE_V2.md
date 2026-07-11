# DATABASE_V2 SPECIFICATION (Sistem Komisen Mawar Teraju)

Dokumen ini mendefinisikan reka bentuk skema pangkalan data bertaraf **business-first**. Pangkalan data menyimpan nilai akhir terhitung (**calculated values**) secara statik. Tiada formula Excel disimpan atau dinilai secara langsung di dalam pangkalan data semasa runtime.

---

## 1. Seni Bina Hubungan Entiti (Relational Structure)

Sistem menggunakan IndexedDB sebagai storan tempatan, tetapi direkabentuk secara relasional menggunakan kunci rujukan berikut untuk integriti data:
*   `Batch ID` (Mengelompokkan rekod mengikut bulan/tahun)
*   `Dispatcher ID` (Menghubungkan rekod komisen dan potongan)
*   `IC Number` (Kunci carian utama bagi Dispatch Portal)

```
[Commission Batch] (1) ───┬─── (N) [Commission Records] (N) ───┐
                          │                                    ├─── [Dispatcher ID] ───► [IC Number]
                          └─── (N) [Deduction Records]  (N) ───┘
```

---

## 2. Definisi Skema Object Store (IndexedDB)

### A. Store: `batches`
Menyimpan maklumat kumpulan batch bayaran komisen mengikut bulan/tahun.
*   **Key Path**: `id` (Auto Increment: `true`)
*   **Index**:
    *   `active` (Unique: `false`) - Status keaktifan carian (`1` = Aktif, `0` = Arkib/Draf).
    *   `status` (Unique: `false`) - Status batch (`"draft"`, `"published"`, `"archived"`).

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | Number | ID Kunci Utama (PK) | `1` |
| `name` | String | Nama batch bayaran | `"Jun 2026"` |
| `month` | Number | Bulan bayaran (1 - 12) | `6` |
| `year` | Number | Tahun bayaran (4 digit) | `2026` |
| `status` | String | Status batch (`"draft"`, `"published"`, `"archived"`) | `"published"` |
| `active` | Number | Bendera carian aktif (`1` = Ya, `0` = Tidak) | `1` |
| `commission_file` | String | Nama fail asal komisen | `"24-NSN305 DSP COMMISSION JUN 2026.xlsx"` |
| `deduction_file` | String | Nama fail asal potongan | `"24-NSN305 DSP COMMISSION JUN 2026.xlsx"` |
| `created_time` | Number | Cap masa penciptaan (timestamp) | `1783430513425` |
| `published_time` | Number | Cap masa diterbitkan | `1783430536579` |

---

### B. Store: `dispatcher_mappings`
Punca kebenaran (Source of Truth) bagi hubungan pemetaan antara ID Dispatcher tempatan dan No. IC rasmi.
*   **Key Path**: `dispatcher_id` (Unique ID, cth: `"NSN3052004"`)
*   **Index**:
    *   `ic_number` (Unique: `true`) - Nombor IC 12-digit (tanpa sengkang) untuk carian pantas.

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `dispatcher_id` | String | ID Dispatcher unik (PK) | `"NSN3052004"` |
| `ic_number` | String | Nombor Kad Pengenalan | `"920605055111"` |
| `name` | String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| `last_updated` | Number | Cap masa kemaskini terakhir | `1783430536579` |

---

### C. Store: `commission_records`
Menyimpan nilai komisen akhir yang telah dikira. Tiada formula Excel disimpan.
*   **Key Path**: `id` (Auto Increment: `true`)
*   **Index**:
    *   `batchId` (Unique: `false`)
    *   `dispatcher_id` (Unique: `false`)
    *   `ic_number` (Unique: `false`)
    *   `batch_ic` (Unique: `true`, Composite: `['batchId', 'ic_number']`)

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | Number | ID Kunci Utama (PK) | `1` |
| `batchId` | Number | Rujukan ke `batches.id` (FK) | `1` |
| `dispatcher_id` | String | Rujukan ke `dispatcher_mappings.dispatcher_id` (FK) | `"NSN3052004"` |
| `ic_number` | String | No. IC yang dipetakan | `"920605055111"` |
| `name` | String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| `parcel_qty` | Number | Jumlah parcel yang dihantar | `2335` |
| `net_parcel` | Number | Parcel pengecualian YOYI | `2` |
| `exclude_extra_weight_yoyi` | Number | Kuantiti parcel ditolak YOYI | `2333` |
| `commission_rate` | Number | Komisen asas (RM1.11 per parcel) | `2591.85` |
| `diff_rate_new_joiner` | Number | Denda/pelarasan kadar new joiner | `0.00` |
| `count_pickup` | Number | Kiraan pickup dispatcher | `0` |
| `extra_weight_commission` | Number | Komisen berat tambahan akhir | `50.00` |
| `total_commission` | Number | Jumlah kasar komisen (F - G + I) | `2641.85` |
| `addition_pickup_commission`| Number | Komisen pickup tambahan | `15.30` |
| `addition_fuel_allowance` | Number | Elaun minyak tambahan | `0.00` |
| `addition_sorter` | Number | Elaun sorter tambahan | `0.00` |
| `nett_commission` | Number | Komisen bersih sebelum pembundaran | `2646.2644` |
| `final_amount_to_pay` | Number | Bayaran akhir bersih (pembundaran 2 dp) | `2646.26` |
| `system_reg` | String | Nombor rujukan sistem pendaftaran | `"SN001"` |
| `status_payment` | String | Status bayaran semasa | `"SUCCESS"` |
| `date_payment` | String | Tarikh bayaran diproses | `"2026-06-15"` |
| `remark` | String | Catatan admin | `""` |

---

### D. Store: `deduction_records`
Menyimpan semua perincian potongan akhir dari sheet `Details Penalty` dan potongan ringkasan dari `Dispatcher Comm`.
*   **Key Path**: `id` (Auto Increment: `true`)
*   **Index**:
    *   `batchId` (Unique: `false`)
    *   `dispatcher_id` (Unique: `false`)
    *   `ic_number` (Unique: `false`)
    *   `batch_ic` (Unique: `true`, Composite: `['batchId', 'ic_number']`)

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | Number | ID Kunci Utama (PK) | `1` |
| `batchId` | Number | Rujukan ke `batches.id` (FK) | `1` |
| `dispatcher_id` | String | Rujukan ke `dispatcher_mappings.dispatcher_id` (FK) | `"NSN3052004"` |
| `ic_number` | String | No. IC yang dipetakan | `"920605055111"` |
| `name` | String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| **Butiran Potongan Am**: | | | |
| `deduction_advance` | Number | Potongan pinjaman pendahuluan | `0.00` |
| `deduction_pending_cod` | Number | Potongan COD tertangguh | `0.00` |
| `deduction_duitnow_penalty` | Number | Potongan denda DuitNow | `0.00` |
| `deduction_late_cod_penalty`| Number | Potongan denda COD lewat | `0.00` |
| **Butiran Potongan Denda (Details Penalty)**: | | | |
| `lost_pic_signed` | Number | Potongan lost parcel PIC signed | `10.8856` |
| `lost_rate` | Number | Potongan kadar lost parcel | `0.00` |
| `total_all_lost_shared` | Number | Jumlah denda lost parcel hub | `10.8856` |
| `lost_parcel_pic_signed` | Number | Potongan denda lost parcel individu | `0.00` |
| `arbi_individual` | Number | Potongan denda ARBI | `0.00` |
| `rcgen_penalty` | Number | Potongan denda RCGEN | `0.00` |
| `qc_penalty` | Number | Potongan denda QC | `0.00` |
| `total_hq_penalty_detail` | Number | Jumlah keseluruhan denda HQ | `0.00` |
