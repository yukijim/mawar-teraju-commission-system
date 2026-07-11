# IMPORT FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

Dokumen ini memperincikan saluran paip import (import pipeline) teknikal dari fail fizikal Excel sehingga menjadi rekod statik dalam pangkalan data.

---

## 1. Saluran Paip Pemprosesan Fail (File Processing Pipeline)

Proses import bertaraf **business-first** memastikan pengesahan skema lajur dan hubungan relational dikira sepenuhnya sebelum penulisan ke pangkalan data dijalankan.

```
[ Upload Excel ]
       │
       ▼
[ Parse Sheets (SheetJS) ] ──► (Imbas 'Dispatcher Comm' & 'Details Penalty')
       │
       ▼
[ Schema Validation ] ─────► (Sahkan Kewujudan Kolum Wajib)
       │
       ▼
[ Build Master Mapping ] ──► (Petakan Dispatcher ID ──► COUNT DIGIT/No. IC)
       │
       ▼
[ Compute Calculations ] ──► (Hitung RM1.11 Comm, Extra Weight Comm, Nett, Rounding)
       │
       ▼
[ Resolve Deductions ] ────► (VLOOKUP details menggunakan Master Mapping)
       │
       ▼
[ Save to IndexedDB ] ─────► (Tulis ke Store 'commission_records' & 'deduction_records')
```

---

## 2. Peringkat Pemprosesan (Processing Stages)

### Peringkat A: Pembacaan Sheet & Pengesahan Skema
1.  Admin memuat naik fail Excel.
2.  Sistem menyemak senarai sheet dalam fail:
    *   Mencari sheet `"Dispatcher Comm"` untuk data komisen.
    *   Mencari sheet `"Details Penalty"` untuk data denda.
3.  Sistem mengesahkan lajur wajib. Lajur berikut **mesti ada** untuk pemprosesan:
    *   **Dispatcher Comm**: `Delivery Dispatcher ID`, `Delivery Dispatcher Name`, `Parcel Quantity`, `Net Parcel`, `COUNT DIGIT` (Col Y), `FINAL AMOUNT TO PAY`.
    *   **Details Penalty**: `Delivery Dispatcher ID`, `Delivery Dispatcher Name`, `TOTAL ALL LOST SHARED`, `TOTAL HQ PENALTY`.
4.  Jika mana-mana lajur wajib tiada, import dibatalkan dan sistem memaparkan senarai lajur yang hilang.

### Peringkat B: Pengekstrakan Master Mapping (Dispatcher ID $\rightarrow$ IC)
1.  Sistem mengimbas sheet `"Dispatcher Comm"` bermula baris ke-3 (data baris pertama selepas tajuk lajur).
2.  Untuk setiap baris, sistem membaca:
    *   `Delivery Dispatcher ID` (Col A)
    *   `COUNT DIGIT` (Col Y) $\rightarrow$ Ini mengandungi No. IC
3.  Sistem menapis No. IC dengan membuang ruang kosong dan sengkang (cth: `920605-05-5111` $\rightarrow$ `920605055111`).
4.  Hubungan pemetaan ini disimpan ke dalam stor ingatan sementara (in-memory map) `MasterMapping`.
5.  Setiap entri pemetaan ditulis ke dalam store `dispatcher_mappings` untuk rekod rujukan kekal sistem.

### Peringkat C: Pengiraan Komisen & Pelarasan
1.  Sistem memproses baris-baris pada `"Dispatcher Comm"`.
2.  Bagi setiap baris, nilai-nilai berikut dihitung secara programmatik:
    *   `parcel_qty` = Nilai angka pada Col C.
    *   `net_parcel` = Nilai angka pada Col D.
    *   `exclude_extra_weight_yoyi` = `parcel_qty` - `net_parcel` (Col C - Col D).
    *   `commission_rate` = `parcel_qty` * `1.11` (Kadar komisen tetap RM1.11).
    *   `diff_rate_new_joiner` = Nilai angka pada Col G.
    *   `count_pickup` = Nilai angka pada Col H.
    *   `extra_weight_commission` = (Nilai komisen berat dari `AWB Data` jika dibekalkan) - `exclude_extra_weight_yoyi`. (Jika tiada data `AWB Data`, sistem menggunakan nilai statik dari Col I).
    *   `total_commission` = `commission_rate` - `diff_rate_new_joiner` + `extra_weight_commission` (Col F - Col G + Col I).
3.  Semua nilai disimpan sebagai jenis data angka (`Number`). Tiada formula Excel disimpan.

### Peringkat D: Penyelarasan Potongan & Denda (VLOOKUP Resolving)
1.  Sistem membaca sheet `"Details Penalty"` bermula baris ke-3.
2.  Bagi setiap baris, sistem memadankan `Delivery Dispatcher ID` (Col A) dalam `Details Penalty` dengan `MasterMapping` yang telah dibina.
3.  No. IC yang sepadan diambil daripada map. Jika tiada, denda dianggap tidak dipetakan ke IC dan sistem memaparkan amaran, tetapi import diteruskan dengan rujukan Dispatcher ID.
4.  Butiran denda berikut dibaca:
    *   `lost_pic_signed` = Col C.
    *   `lost_rate` = Col D.
    *   `total_all_lost_shared` = Col E (Denda Lost Parcel Hub).
    *   `lost_parcel_pic_signed` = Col H (Denda Lost Parcel Individu).
    *   `arbi_individual` = Col J.
    *   `rcgen_penalty` = Col K.
    *   `qc_penalty` = Col L.
    *   `total_hq_penalty_detail` = Col M.
5.  Sistem menyilang (join) data potongan di atas dengan data potongan ringkasan pada `"Dispatcher Comm"` bagi dispatcher yang sama (advance, pending COD, duitnow, dll) dan menyimpannya ke store `deduction_records` berindeks `batchId` dan `ic_number`.

### Peringkat E: Transaksi DB & Kemas Kini Status Batch
1.  Sistem melancarkan satu transaksi penulisan asinkronus ke IndexedDB.
2.  Data komisen dan potongan lama bagi batch ini dibersihkan terlebih dahulu (jika ia kemaskini batch draf).
3.  Semua rekod komisen dan potongan baharu ditulis.
4.  Metadata batch dikemas kini dengan jumlah baris yang berjaya diimport dan nama fail asal.
5.  Proses import selesai. Status batch ditetapkan kepada `"draft"` (kecuali admin terus menekan terbit).
