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
| `commission_file` | String | Nama fail asal komisen | `"commission_jun_2026.xlsx"` |
| `deduction_file` | String | Nama fail asal potongan | `"deduction_jun_2026.xlsx"` |
| `created_time` | Number | Cap masa penciptaan (timestamp) | `1783430513425` |
| `published_time` | Number | Cap masa diterbitkan | `1783430536579` |

---

### B. Store: `dispatcher_mappings`
Punca kebenaran (Source of Truth) bagi hubungan pemetaan antara ID Dispatcher tempatan dan No. IC rasmi.
*   **Key Path**: `dispatcher_id` (Unique ID, cth: `"NSN3052004"`)
*   **Index**:
    *   `ic_number` (Unique: `false`) - Nombor IC 12-digit (tanpa sengkang) untuk carian pantas.

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `dispatcher_id` | String | ID Dispatcher unik (PK) | `"NSN3052004"` |
| `ic_number` | String | Nombor Kad Pengenalan | `"070614101708"` |
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
    *   `batch_ic` (Unique: `false`, Composite: `['batchId', 'ic_number']`)

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | Number | ID Kunci Utama (PK) | `1` |
| `batchId` | Number | Rujukan ke `batches.id` (FK) | `1` |
| `dispatcher_id` | String | Rujukan ke `dispatcher_mappings.dispatcher_id` (FK) | `"NSN3052004"` |
| `ic_number` | String | No. IC yang dipetakan | `"070614101708"` |
| `name` | String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| `parcel_qty` | Number | Jumlah parcel yang dihantar | `150` |
| `commission_rate` | Number | Komisen asas (RM1.15 per parcel) | `172.50` |
| `extra_weight_commission` | Number | Komisen berat tambahan akhir | `8.50` |
| `total_commission` | Number | Jumlah kasar komisen | `181.00` |
| `addition_pickup_commission`| Number | Komisen pickup tambahan | `15.30` |
| `addition_fuel_allowance` | Number | Elaun minyak tambahan / refund penalty | `5.00` |
| `addition_sorter` | Number | Elaun sorter tambahan | `0.00` |
| `nett_commission` | Number | Komisen bersih sebelum pembundaran | `201.30` |
| `final_amount_to_pay` | Number | Bayaran akhir bersih (pembundaran 2 dp) | `201.30` |
| `status_payment` | String | Status bayaran semasa | `"SUCCESS"` |
| `date_payment` | String | Tarikh bayaran diproses | `"2026-06-15"` |
| `remark` | String | Catatan admin | `""` |

---

### D. Store: `deduction_records`
Menyimpan semua perincian potongan akhir dari sheet `Deduction`.
*   **Key Path**: `id` (Auto Increment: `true`)
*   **Index**:
    *   `batchId` (Unique: `false`)
    *   `dispatcher_id` (Unique: `false`)
    *   `ic_number` (Unique: `false`)
    *   `batch_ic` (Unique: `false`, Composite: `['batchId', 'ic_number']`)

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | Number | ID Kunci Utama (PK) | `1` |
| `batchId` | Number | Rujukan ke `batches.id` (FK) | `1` |
| `dispatcher_id` | String | Rujukan ke `dispatcher_mappings.dispatcher_id` (FK) | `"NSN3052004"` |
| `ic_number` | String | No. IC yang dipetakan | `"070614101708"` |
| `name` | String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| `deduction_others` | Number | Potongan pinjaman pendahuluan / lain-lain | `50.00` |
| `deduction_pending_cod` | Number | Potongan COD tertangguh | `0.00` |
| `deduction_hq_penalty` | Number | Potongan denda HQ | `10.00` |
| `deduction_duitnow_penalty` | Number | Potongan denda DuitNow | `0.00` |
| `deduction_late_cod_penalty`| Number | Potongan denda COD lewat | `0.00` |
| `deduction_lost_individual` | Number | Potongan lost parcel individu | `0.00` |
| `deduction_lost_parcel_hub` | Number | Potongan lost parcel hub | `0.00` |

---

### E. Table: `penalty_records` (PostgreSQL / Backend storage)
Menyimpan semua perincian denda AWB dari sheet `Penalty`.
*   **Key Path**: `id` (UUID)
*   **Index**:
    *   `delivery_dispatcher_id` (Unique: `false`)

| Nama Medan (Property) | Jenis Data | Penerangan | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID) | ID Kunci Utama (PK) | `"a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"` |
| `delivery_dispatcher_id` | String | Rujukan ke `dispatcher_mappings.dispatcher_id` (FK) | `"NSN3052004"` |
| `delivery_dispatcher_name`| String | Nama penuh dispatcher | `"MOHAMAD AZLAN BIN JAAPAR"` |
| `awb` | String | Nombor AWB parcel (Unik) | `"MY123456789"` |
| `fake_return` | Number | Denda fake return | `5.00` |
| `fake_problematic` | Number | Denda fake problematic | `0.00` |
| `fraud_delivery` | Number | Denda fraud delivery | `0.00` |
| `arbitration` | Number | Denda arbitration | `10.00` |
| `individual_lost` | Number | Denda lost individual | `0.00` |
| `logic` | Number | Denda logic | `0.00` |
