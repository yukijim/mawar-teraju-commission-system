# SYSTEM ARCHITECTURE SPECIFICATION (Sistem Komisen Mawar Teraju)

Dokumen ini memperincikan reka bentuk seni bina modular bagi Commission Lookup System, memisahkan bahagian persembahan (UI), logik perniagaan, dan storan data.

---

## 1. Gambarajah Seni Bina (Architectural Layers)

Aplikasi beroperasi sebagai sistem **client-side modular** v2 yang terpisah daripada struktur formula lembaran Excel:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (UI)                         │
│   - index.html (Views: Search, Admin, Dashboard)                       │
│   - styles.css (Branding Maroon & Gold, Glassmorphic Dashboard)        │
│   - ui.js (Toast Alerts, Modal Controller, Lucide Render)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC LAYER                            │
│   - app.js (Main System Orchestrator & View Routing)                   │
│   - auth.js (Admin Access Control with SHA-256 Mocking)                │
│   - upload.js (Batch Uploader & File Multi-Dropzone Controller)        │
│   - excel.js (SheetJS parsing, validation & JS aggregates computation) │
│   - dispatch.js (Search portal & jsPDF Report Export Engine)           │
│   - dashboard.js (Admin analytics, rollback & batch status controller) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       DATA ACCESS LAYER (DAL)                          │
│   - db.js (MTDatabase - CRUD wrappers over IndexedDB)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                 │
│   - IndexedDB (MawarTerajuCommissionDB - Schema Version 4)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Penghuraian Tanggungjawab Modul (Component Responsibilities)

### A. Presentation Layer (UI)
*   **index.html**: Menguruskan DOM views. Mempunyai 3 skrin utama: Pilihan Peranan (Role Select), Dashboard Admin, dan Portal Carian Dispatcher.
*   **styles.css**: Menguruskan identiti korporat. Menggunakan CSS Custom Properties (`--primary: #8E1B32` maroon, `--accent: #D4AF37` gold) dan susun atur responsif grid/flex.
*   **ui.js**: Membungkus panggilan cache DOM (`DomCache`) untuk mengelakkan ralat manipulasi DOM bertindih.

### B. Business Logic Layer
*   **excel.js**: Mengandungi pemeta skema lajur. Modul ini menghuraikan fail Excel, mengesahkan lajur wajib, dan menjalankan pengiraan matematik (seperti pengganti formula `VLOOKUP`, `SUMIFS`, `COUNTIFS`) menggunakan JavaScript tulen semasa proses muat naik.
*   **upload.js**: Menguruskan dropzone dan kitaran hayat import data. Ia menyokong pemuatan fail draf dan koordinasi import asinkronus dalam bentuk kelompok (batch chunks).
*   **dispatch.js**: Mengendalikan portal carian dispatch. Ia melaksanakan sanitasi carian IC dan menyusun data komisen & potongan dari database ke dalam susun atur laporan cetak menggunakan `jsPDF`.
*   **dashboard.js**: Memaparkan analitis draf vs published batch, menguruskan penukaran keaktifan batch (`active: 1` vs `0`), dan memanggil fungsi rollback.

### C. Data Access Layer (DAL)
*   **db.js**: Membungkus IndexedDB API ke dalam reka bentuk berasaskan Promise. Ia menguruskan transaksi selamat (`readwrite` / `readonly`), mewujudkan struktur storan data (`batches`, `commission_records`, `deduction_records`, `dispatcher_mappings`), dan menguatkuasakan operasi melata (cascade deletes) apabila batch dipadam.

---

## 3. Strategi Pengasingan Excel (Excel Decoupling Strategy)

Sistem ini mematuhi prinsip **decoupled business logic** di mana fail Excel hanya digunakan sebagai medium pemindahan data (data transport):

1.  **Parsing Asing**: SheetJS membaca data sel sebagai nilai mentah (raw values) atau nilai paparan terhitung (calculated values).
2.  **Tiada Formula Live**: Kod sistem tidak memanggil semula enjin formula live. Pengiraan seperti komisen bersih dan potongan denda diselesaikan sepenuhnya di bahagian pelanggan menggunakan struktur JavaScript yang tegar sebelum disimpan ke pangkalan data.
3.  **Ketersediaan Offline**: Data yang dicari oleh dispatcher dimuatkan dari IndexedDB tempatan secara 100% tanpa memerlukan program Excel fizikal dijalankan atau dipasang pada peranti dispatcher.
