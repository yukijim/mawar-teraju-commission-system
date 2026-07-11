# BUSINESS FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

Dokumen ini mendefinisikan aliran perniagaan (business flows) bagi kitaran hayat Batch Komisen dan interaksi Dispatcher di portal semakan.

---

## 1. Aliran Kerja Pengurusan Batch (Admin Workflow)

Kitaran hayat bagi data komisen diuruskan oleh pentadbir melalui langkah-langkah berikut:

```
[ Cipta Batch ] ──► [ Draf ] ──► [ Validasi & Import ] ──► [ Terbitkan ] ──► [ Aktif & Boleh Dicari ] ──► [ Diarkib ]
```

### A. Mewujudkan Kumpulan Bayaran (Batch Creation)
1.  Admin mengakses panel pengurusan batch.
2.  Admin memasukkan **Nama Batch** (cth: `"Jun 2026"`), **Bulan** (`6`), dan **Tahun** (`2026`).
3.  Batch baharu dicipta dalam keadaan **Draf** (`status = 'draft'`, `active = 0`).

### B. Validasi & Import Data
1.  Sistem menyokong import fail Excel berasingan atau fail tunggal yang disatukan (consolidated workbook).
2.  Laporan **Commission Report** (Sheet: `Dispatcher Comm`) dan laporan **Deduction Details** (Sheet: `Details Penalty`) dimuat naik.
3.  Sistem mengesahkan struktur data lajur (Schema Validation). Sebarang kegagalan struktur akan menyekat proses import.
4.  JavaScript memproses pengiraan lookup, penjumlahan, dan pembundaran mengikut logik perniagaan:
    *   Membina pemetaan `Dispatcher ID` $\rightarrow$ `No. IC`.
    *   Mengira komisen bersih (`nett_commission`) dan jumlah bayaran akhir (`final_amount_to_pay`).
5.  Data yang telah bersih disimpan sebagai nilai statik dalam database IndexedDB.

### C. Penerbitan & Pengarkiban (Publish & Archive)
1.  Sebuah batch draf tidak boleh dicari oleh dispatch.
2.  Admin meneliti ringkasan batch (jumlah rekod, jumlah pembayaran) dan mengklik **Terbitkan (Publish)**.
3.  Status batch dikemas kini kepada `"published"` dan `active` diset kepada `1`.
4.  Semua batch published yang terdahulu diubah `active` kepada `0`. Ini memastikan **hanya satu batch published sahaja** yang aktif untuk carian dispatch pada satu masa.
5.  Untuk mengunci data dari sebarang carian masa depan, admin boleh menukar status batch kepada `"archived"`.

---

## 2. Aliran Kerja Carian Portal Dispatch (Search Workflow)

Semakan data oleh rider/dispatcher mengikut langkah-langkah berikut:

```
[ Log Masuk Portal ] ──► [ Masukkan No. IC ] ──► [ Cari Batch Aktif (Published) ] ──► [ Papar Ringkasan ] ──► [ Muat Turun PDF ]
```

### A. Pengesahan Carian
1.  Dispatcher memasukkan Nombor Kad Pengenalan (IC) 12-digit pada portal carian.
2.  Sistem membersihkan input (membuang sengkang dan ruang kosong).
3.  Portal menyemak pangkalan data untuk mencari **satu-satunya batch published yang aktif** (`status = 'published'`, `active = 1`).

### B. Pengambilan & Integrasi Data
1.  Menggunakan indeks komposit `batch_ic` (menggabungkan `batchId` aktif dan `ic_number` yang dicari), sistem mencari rekod sepadan dalam store:
    *   `commission_records`
    *   `deduction_records`
2.  Jika tiada rekod dijumpai, portal memaparkan mesej makluman "Rekod komisen tidak ditemui bagi No. IC ini untuk batch semasa".
3.  Jika dijumpai, sistem menggabungkan rekod komisen dan butiran potongan berdasarkan `dispatcher_id` yang sepadan.

### C. Paparan Ringkasan & Dokumentasi
1.  Portal memaparkan ringkasan kewangan yang jelas kepada dispatcher:
    *   **Final Amount to Pay** (Bayaran Bersih Akhir)
    *   **Jumlah Komisen Kasar**
    *   **Jumlah Potongan/Denda**
    *   **Jumlah Tambahan/Allowance**
2.  Portal menyediakan dua butang muat turun berasingan untuk dokumentasi rasmi:
    *   **Muat Turun Commission Report (PDF)**: Laporan rasmi komisen dan allowance dispatcher.
    *   **Muat Turun Details Deduction Report (PDF)**: Laporan butiran terperinci denda dan penalti (QC, RCGEN, Lost) dari `Details Penalty`.
3.  Tiada maklumat dispatcher lain didedahkan semasa proses carian ini.
