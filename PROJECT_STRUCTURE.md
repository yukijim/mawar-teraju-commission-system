# Project Structure

Dokumen ini menjelaskan struktur folder dan perincian tanggungjawab bagi setiap fail kod sumber dalam sistem.

## Struktur Fail Projek

```
c:\_MT Sistem Com\
├── assets/
│   └── images/
│       └── branding/
│           ├── logo.png       - Logo syarikat rasmi (Maroon/Gold/White)
│           ├── favicon.ico    - Favicon tapak penyemak imbas
│           └── favicon-32x32.png - Favicon saiz 32x32 PNG rasmi
├── auth.js            - Pengurusan pengesahan kata laluan Admin
├── db.js              - Pangkalan data IndexedDB (v3) & operasi batch
├── excel.js           - Penghuraian spreadsheet Excel & pemetaan skema split
├── ui.js              - Pengurusan widget UI, modal, toast & caching DOM
├── router.js          - Penghalaan URL Hash & sekatan akses admin
├── dispatch.js        - Carian komisen dispatch, dual merge & PDF exports
├── admin.js           - Sesi log masuk admin, backup/restore & log audit
├── upload.js          - Pemuat naik fail Excel, drag/drop, draf & simulation
├── dashboard.js       - Statistik dashboard admin, activation & rollback
├── app.js             - Penskriptan bootstrap utama (Facade Coordinator)
├── index.html         - Antara muka HTML5 aplikasi (Branded)
├── styles.css         - Penggayaan Vanilla CSS (Tema Maroon & Gold)
├── test_runner.html   - Suite ujian regresi asinkronus (13 Kes Ujian)
├── RELEASE_NOTES.md   - Nota keluaran modul, siap/belum & had sistem
├── VERSION.md         - Rekod tag versi semasa dan status kitaran projek
├── README.md          - Dokumentasi utama projek
├── DEPLOYMENT.md      - Panduan deployment & Senarai Semak Go-Live
├── DATABASE.md        - Rekod skema IndexedDB & peraturan perniagaan
└── API.md             - Reka bentuk konseptual REST API Sprint 2
```

---

## Spesifikasi Modul & Fungsi Utama

### 1. `app.js` (Coordinator & Bootstrapper)
Menjadi titik masuk (entry-point) aplikasi. Mengagregatkan semua modul ke dalam `window.App` dan bertindak sebagai penapis ralat sistem berpusat.
* **`ErrorHandler.handle(error, context)`**: Menangkap ralat, mengeluarkan makluman toast, dan menulis ke log pangkalan data.
* **`init()`**: Mengaktifkan sistem penyedia Hash (`Auth`), membuka sambungan pangkalan data (`DB`), memulakan penghalaan (`Router`), dan merender ikon.

### 2. `ui.js` (User Interface Management)
Menguruskan rendering grafik, tetingkap modal overlay, dan notifikasi terapung. Mempunyai cache DOM bersepadu untuk prestasi optimum.
* **`DomCache.get(id)`**: Mengembalikan rujukan element DOM. Memastikan `document.getElementById` tidak dipanggil berulang kali untuk elemen yang sama.
* **`renderIcons()`**: Memproses semula rendering ikon menggunakan perpustakaan Lucide.
* **`showToast(title, desc, type)`**: Membina notifikasi visual terapung (success, danger, warning, info).
* **`updateHeaderActions(currentView)`**: Mengemas kini item menu di bahagian kepala mengikut peranan pengguna semasa.
* **`openPasswordModal()` / `closePasswordModal()`**: Mengurus status paparan modal penukaran kata laluan.
* **`openAuditModal()` / `closeAuditModal()`**: Membuka modal paparan rekod log audit dan mengisi kandungannya dari pangkalan data.

### 3. `router.js` (Client-side Routing)
Mengawal peralihan paparan (views) berdasarkan perubahan hash pada URL (`window.location.hash`).
* **`init()`**: Mendaftar pendengar acara `hashchange` dan klik logo utama (hanya didaftarkan sekali).
* **`routeByHash()`**: Membaca hash semasa, menyemak sekatan akses ke papan pemuka Admin, dan mengaktifkan paparan.
* **`navigateTo(viewId)`**: Mengubah hash pada URL untuk menavigasi pengguna ke paparan sasaran.
* **`activateView(viewId)`**: Menambah kelas CSS `.active` pada kad paparan sasaran dan memicu fungsi penyediaan modul berkaitan (contoh: memuatkan statistik semasa mengaktifkan dashboard).

### 4. `dispatch.js` (Dispatcher Search Execution)
Mengawal antara muka pencarian dan pemformatan nombor pengenalan rider.
* **`bindIcFormatter()`**: Memasang format auto-semak pada input IC (format: XXXXXX-XX-XXXX) pada acara input pertama (didaftarkan sekali).
* **`resetSearch()`**: Mengosongkan medan input dan menyembunyikan kawasan hasil carian.
* **`handleSearch(event)`**: Melakukan carian ke IndexedDB, memproses jumlah komisen terkumpul, dan menjana senarai 20 kolum terperinci bagi setiap transaksi.

### 5. `admin.js` (Admin Maintenance Actions)
Mengendalikan tugas penyenggaraan data dan pengesahan sesi pentadbir.
* **`handleLogin(event)`**: Menentusahkan kata laluan admin dan mencipta sesi penyimpanan sesi (`sessionStorage`).
* **`handleLogout()`**: Menamatkan sesi semasa dan kembali ke pemilihan peranan.
* **`handleChangePassword(event)`**: Menukar kata laluan pentadbir selepas pengesahan kata laluan lama.
* **`confirmClearDatabase()`**: Memadam keseluruhan rekod komisen dan sejarah muat naik selepas pengesahan Admin.
* **`downloadBackup()`**: Mengeksport keseluruhan stor data IndexedDB ke format JSON dan memuat turun ke komputer tempatan.
* **`handleRestoreBackup(event)`**: Membuka fail JSON backup, membersihkan pangkalan data semasa, dan mengimport rekod sandaran.
* **`clearSystemAuditLogs()`**: Mengosongkan keseluruhan log audit keselamatan sistem.

### 6. `upload.js` (Spreadsheet Import Engine)
Mengurus pemprosesan dan kemasukan data komisen secara besar-besaran daripada fail Excel.
* **`bindUploadEvents()`**: Memasang event listener drag-and-drop di kawasan zon muat naik (didaftarkan sekali).
* **`handleFileSelect(file)`**: Melakukan semakan lanjutan terhadap sambungan fail, memicu parser SheetJS, memaparkan senarai amaran skema, dan memaparkan butang import.
* **`cancelFileSelection()`**: Mengosongkan fail terpilih dan menetapkan semula antara muka muat naik fail.
* **`confirmAndImport()`**: Membaca strategi penduaan (Replace/Merge) dan mengimport data ke dalam IndexedDB dengan petunjuk peratusan kemajuan.
* **`downloadTemplate()`**: Menjana templat Excel contoh dengan 20 tajuk standard dan memuat turunnya.
* **`runTestUpload()`**: Membina data simulasi spreadsheet Excel secara rawak dalam memori dan memicu alir kerja muat naik untuk tujuan ujian pantas.

### 7. `dashboard.js` (Stats & Upload History Loader)
Memantau metrik data sistem dan sejarah manipulasi fail.
* **`loadDashboardStats()`**: Mengira bilangan transaksi semasa, fail yang dimuat naik, dan masa kemas kini terakhir untuk dipaparkan di widget dashboard.
* **`handleRollback(historyId)`**: Melakukan pembatalan transaksi (rollback) dengan memadamkan semua rekod transaksi yang sepadan dengan ID fail muat naik tertentu.
