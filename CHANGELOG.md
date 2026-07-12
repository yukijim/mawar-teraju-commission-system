# Rekod Perubahan (Changelog)

Semua perubahan penting bagi projek Commission Lookup System akan direkodkan dalam fail ini mengikut spesifikasi [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.8.0] - 2026-07-12

### Selesai (Added)
* **Dashboard Analytics, Backup & Monitoring (v1.8.0)**:
  * **Carian Metrik Dashboard**: Menyediakan fungsi pengiraan data agregat kewangan bagi keseluruhan batch published (jumlah pembayaran, purata komisen bulanan, jumlah dispatcher, penalti kasar).
  * **Tren Perbandingan Bulanan**: Menyusun sejarah trend pembayaran bulanan sehingga 12 period sebelumnya untuk paparan dashboard.
  * **Sistem Data Backup Tersendiri (Programmatic Exporter)**: Membina utiliti penyusunan data backup relasi secara langsung dari data jadual Postgres ke barisan arahan Insert SQL (.sql file) secara mandiri (tidak bergantung kepada OS command).
  * **Monitor Kesihatan Sistem**: Gumpalan data latency DB ping, status uptime pelayan Node, proses heap memory, OS free memory, CPU core, serta jumlah active locks secara real-time.
  * **API REST Dashboard & Monitor**: Menyediakan endpoint:
    * `GET /api/v1/dashboard/summary`
    * `POST /api/v1/admin/backup`
    * `GET /api/v1/admin/monitor`
  * **Audit Log Baharu**: Merekodkan perlakuan audit secara spesifik: `VIEW_DASHBOARD`, `DATABASE_BACKUP`, `SYSTEM_MONITOR`, `COMMISSION_PDF_DOWNLOADED`, dan `DEDUCTION_PDF_DOWNLOADED`.

---

## [1.7.0] - 2026-07-12

### Selesai (Added)
* **PDF Report Engine & Search Hardening (v1.7.0)**:
  * **Sekuriti & Hardening Indeks Komposit**: Menambahkan indeks komposit di PostgreSQL untuk optimal carian: `uq_commission_batch_ic (batch_id, ic_number)`, `idx_commission_batch_dispatcher (batch_id, dispatcher_id)`, dan `idx_search_history_created_user (created_at, user_id)`.
  * **Validasi Had & Normalisasi IC**: Mengunci had parameter limit pencarian maksimum pada 100 secara mutlak, serta menormalisasikan No. IC input dengan membuang aksara sempang `-` dan ruang kosong.
  * **Aliran Ralat Spesifik**: Menambah sistem maklum balas bagi error kes khas: `UPLOAD_BATCH_NOT_FOUND` (404 apabila batch tiada), `SEARCH_RECORD_NOT_FOUND` (404 jika rekod tiada), dan `SEARCH_MAPPING_INCOMPLETE` (403 jika mapping rider tidak lengkap).
  * **Enjin Kompilasi PDF Berprestasi**: Membina enjin penghasilan PDF dalam kod JavaScript tulen tanpa kebergantungan library NPM pihak ketiga (no kit/pdfmake dependency), bagi A4 document streaming yang pantas.
  * **Dua Format Laporan Berasingan**:
    * **Commission Report**: Laporan komisen bulanan bertema merah Maroon dengan pecahan penghantaran, allowance, dan potongan.
    * **Deduction Details**: Laporan terperinci potongan denda bertema emas Gold memaparkan lost pic, penalty, dan arbi.
  * **Sekatan Keselamatan Muat Turun**: Memastikan data hanya diambil dari batch berstatus `PUBLISHED`. Mengunci endpoint reports untuk peranan `DISPATCH` agar hanya boleh memuat turun dokumen milik profil mereka sendiri berdasarkan pemetaan NRIC yang sah.
  * **API REST Laporan**: Menyediakan endpoint:
    * `GET /api/v1/reports/commission/:recordId`
    * `GET /api/v1/reports/deduction/:recordId`

---

## [1.6.0] - 2026-07-12

### Selesai (Added)
* **Enterprise Commission Search Engine (v1.6.0)**:
  * **Carian Berbilang Parameter**: Membolehkan carian rekod komisen berdasarkan Nombor IC, Dispatcher ID, dan Batch ID.
  * **Sekatan Pengesahan Sesi Dispatcher**: Mengunci parameter carian NRIC bagi pengguna bertaraf `DISPATCH` kepada nombor IC profil sendiri sahaja, menyekat akses ke data dispatcher lain. Mengehadkan carian dispatch kepada batch bertaraf `PUBLISHED` dan aktif sahaja.
  * **Sejarah Jejak Carian (Search History Logging)**: Penambahan jadual database `search_history` yang merekodkan data carian (ID pengguna, IC dicari, duration masa milisaat, IP klien, dll) secara terperinci.
  * **Sistem Pagination & Sorting Selamat**: Menyediakan had halaman (`page`, `limit`) serta penyusunan lajur (`sorting`) berasaskan whitelist bagi menghalang serangan SQL injection dinamik.
  * **Saringan Metadata Terperinci (Filtering)**: Menyokong tapisan carian berdasarkan bulan, tahun, dan versi batch secara langsung.
  * **Optimasi Prepared Statements**: Menggunakan pengikatan parameterized query PostgreSQL bagi mempercepatkan eksekusi pelan carian pangkalan data.
  * **API REST Carian**: Menyediakan endpoint:
    * `GET /api/v1/search`
    * `GET /api/v1/search/history` (Had kuasa ADMIN sahaja)
  * **Seni Bina Eksport**: Mempersiapkan reka bentuk controller dan service helper hooks bagi eksport laporan PDF (Maroon & Gold themes) serta grid hamparan Excel.

---

## [1.5.0] - 2026-07-12

### Selesai (Added)
* **Enterprise Batch Management Upgrades (v1.5.0)**:
  * **Kitaran Hayat Batch**: Menguatkuasakan aliran status penuh (`DRAFT`, `VALIDATING`, `IMPORTING`, `IMPORTED`, `PUBLISHED`, `ARCHIVED`).
  * **Sekatan Carian Dispatcher**: Mengehadkan portal carian dispatcher agar hanya membenarkan pertanyaan rekod daripada batch yang bertaraf `PUBLISHED` dan aktif (`is_active = TRUE`).
  * **Pengurusan Versi & Hubungan Rollback**: Menambah lajur versi, status keaktifan, maklumat penerbitan (`published_at`, `published_by`), serta rujukan batch sebelumnya (`previous_batch_id`) ke pangkalan data PostgreSQL.
  * **Endpoint API Progress Upload**: Menyediakan endpoint `GET /api/v1/upload/progress/:batchId` untuk memantau peratusan muat naik dan data rekod yang diproses secara real-time.
  * **Pengesan Rekod Duplikat Unik**: Mengesan pertindihan rekod dalam satu batch dengan memadankan gabungan unik `Batch ID` + `Dispatcher ID` + `IC Number`.
  * **Kunci Muat Naik (Upload Locking)**: Menyediakan sistem kunci berasaskan checksum in-memory bagi mengelakkan publishing atau overwriting semasa proses import sedang berjalan.
  * **Aliran Rollback Versi**: Menyokong endpoint `POST /api/v1/upload/rollback/:batchId` untuk menarik balik batch bermasalah secara automatik dan mengaktifkan semula data batch versi terdahulu.

---

## [1.4.0] - 2026-07-12

### Selesai (Added)
* **Excel Upload Engine & Transactional Bulk Import (v1.4.0)**:
  * **Enjin Import Pasif Backend**: Menggunakan SheetJS dengan konfigurasi `{ raw: false }` untuk membaca hanya nilai terhitung yang dipaparkan dalam sel Excel (no JS formula recalculations), mengekalkan Excel sebagai sumber kebenaran tunggal.
  * **Pengesanan Fail Duplikat (SHA-256 Checksum)**: Menjana checksum SHA-256 bagi setiap fail muat naik untuk mengesan pertindihan. Membenarkan overwrite rekod lama hanya jika parameter overwrite dibekalkan dan pemanggil memegang peranan `ADMIN`.
  * **Transaksi PostgreSQL & Cascading Rollback**: Menggunakan transaksi pool database (`BEGIN` / `COMMIT` / `ROLLBACK`) untuk memastikan integriti data import secara atomik. Kegagalan mana-mana rekod akan melancarkan rollback penuh.
  * **Log Audit Keselamatan**: Merekodkan perlakuan log upload secara automatik: `UPLOAD_STARTED`, `UPLOAD_SUCCESS`, `UPLOAD_FAILED`, dan `UPLOAD_OVERWRITE`.
  * **Had Kadar Muat Naik**: Mengintegrasikan rate limiter khusus `uploadLimiter` (maksimum 20 requests/minute) bagi melindungi pelayan.
  * **API REST Upload**: Menyediakan endpoint API:
    * `POST /api/v1/upload/commission`
    * `POST /api/v1/upload/deduction`
    * `GET /api/v1/upload/history`
    * `GET /api/v1/upload/:batchId`

---

## [1.3.0] - 2026-07-12

### Selesai (Added)
* **Security Hardening & Refactoring (v1.3.0)**:
  * **Hapus Hardcoded Kredensial**: Kredensial pentadbir asal dialihkan sepenuhnya ke pemboleh ubah persekitaran (`.env`).
  * **UUID Secara Global**: Menukarkan semua kunci utama jadual Postgres (`users`, `user_refresh_tokens`, `audit_logs`) daripada `SERIAL`/`BIGSERIAL` kepada `UUID` menggunakan standard `gen_random_uuid()`.
  * **Hashing Refresh Token**: Melindungi refresh token di dalam pangkalan data dengan kaedah pencincangan SHA-256 (hanya hash disimpan bagi mengelakkan kebocoran sesi).
  * **Sistem Jejak Audit (Audit Logging)**: Penambahan jadual `audit_logs` dan `auditLogService` yang merakam secara automatik setiap aktiviti log masuk (berjaya/gagal), log keluar, token tidak sah, dan penggunaan refresh token.
  * **Polisi Keselamatan Kata Laluan**: Menguatkuasakan had minimum 12 aksara, penggunaan huruf besar, huruf kecil, angka, dan simbol khas pada kata laluan menggunakan validator `express-validator`.
  * **Rate Limiting Terperinci (Route-Specific Limiters)**: Menghapuskan pembatas kadar global dan menggantikannya dengan pembatas khusus per-laluan (`loginLimiter` 5 req/min, `searchLimiter` 100 req/min, `uploadLimiter` 20 req/min, `adminLimiter` 60 req/min).
  * **Piawaian Ralat Standard (API Error Standard)**: Menyeragamkan respons ralat API backend kepada struktur `{ success: false, code: "...", message: "...", errors: [] }`.
  * **Helmet Content Security Policy (CSP)**: Mengaktifkan parameter kawalan dasar kandungan Helmet bagi menghalang serangan XSS dan JWT replay.

---

## [1.2.0-beta] - 2026-07-11

### Selesai (Added)
* **UI Freeze & Rekod Penstandardan Visual (v1.2.0-beta)**:
  * Pembekuan antaramuka (UI Freeze) pada versi `Enterprise Light Theme v1.2.0-beta` mengikut prinsip Enterprise Dashboard Design.
  * Penghasilan fail `DESIGN_SYSTEM.md` yang mentakrifkan skala visual spacing (`--space-2xs` hingga `--space-2xl`), skala tipografi (`--text-xs` hingga `--text-4xl`), warna semantik, perpustakaan komponen (buttons, inputs, cards, tables, navigation), dan print guidelines.
  * Pembersihan inline styles pada butang, input, modal, dan log carian dalam `index.html` untuk memusatkan keseluruhan visual kepada token `:root` CSS variables.
  * Pelancaran Sprint 3 Backend Foundation (perancangan Node.js, Express, dan database relasi PostgreSQL).

---

## [1.1.0-beta] - 2026-07-11

### Selesai (Added)
* **Seni Bina Enjin Import Pasif (Passive Cell-Value Extraction)**:
  * Membuang formula aktif JS (`parcel_qty * 1.11`, dll) dan menggunakan Excel sebagai *single source of truth* mutlak. Nilai sel akhir diimport secara terus daripada workbook.
  * Menguji ketepatan desimal pasif berbanding pengiraan formula aktif dalam UAT.
* **Abstraksi Pangkalan Data (Repository & Service Pattern)**:
  * Pengenalan interface `CommissionRepository`, implementasi `IndexedDBRepository`, dan orkestrasi `CommissionService` (`window.DB`). Membolehkan migrasi storage ke PostgreSQL/Backend (Sprint 2) berjalan secara telus tanpa menyentuh UI atau business logic.
  * Skema IndexedDB v4 dengan penambahan store `dispatcher_mappings` untuk relasi dispatcher ID ke IC yang sah.
  * Fungsi penulisan batch secara atomik (`saveBatchData`) yang melancarkan rollback (abort transaction) automatik jika berlaku sebarang ralat import.
* **Tema Terang Korporat & Audit Aksesibiliti (Light Theme v1.1.0-beta)**:
  * Reka bentuk visual semula menggunakan latar belakang off-white (`#F8FAFC`), panel kad putih (`#FFFFFF`), teks slate gelap (`#0F172A`), sempadan lembut (`#CBD5E1`), dan mengekalkan warna Maroon penjenamaan (`#8E1B32`) serta Gold (`#D4AF37`) sebagai aksen utama.
  * Menjalankan UI Accessibility & Contrast Audit menyeluruh ke atas: Header, Sidebar, Dashboard, Forms, Modals, Upload Zone, Tables, PDF Preview, Toasts, dan Footer.
  * Melakukan CSS Refactor untuk menyalurkan semua warna menerusi CSS Variables di bawah `:root` (Design Tokens) dengan menghapuskan semua hardcoded hex/rgba colors di dalam komponen.
  * Memenuhi aksesibiliti minimum WCAG AA dengan kontras tinggi (teks utama Slate 900 `#0F172A`, subtitle Slate 700 `#334155`, secondary text `#475569`, placeholder `#64748B`, table header Maroon dengan teks Putih, dan active navigation Maroon dengan teks Putih).
* **Ujian Regresi Automatik Sukses**:
  * Pengemaskinian suite ujian `test_runner.html` untuk memadankan skema v4, rollback transaksi, dan UAT passive mapping dengan kelulusan 100% (13/13 PASS).

---

## [1.0.0-beta] - 2026-07-08

### Selesai (Added)
* **Seni Bina Commission Batch (Batch Architecture)**:
  * Pembangunan skema IndexedDB Versi 3 dengan kedai objek berasingan (`batches`, `commission_records`, dan `deduction_records`) dan indeks komposit `['batchId', 'ic_number']` untuk prestasi pencarian optimum.
  * Penyediaan sistem draf dan penerbitan (draft/publish workflow) bagi memastikan batch tidak boleh diaktifkan sehinggalah kedua-dua fail laporan (Komisen & Butiran Potongan) dimuat naik dan disahkan sah.
  * Ciri rollback data transaksi batch secara penuh (cascade delete bagi rekod komisen, potongan, dan kemas kini status batch).
* **Penstandardan Identiti Visual (Branding)**:
  * Pemusatan semua fail visual di bawah direktori rasmi `/assets/images/branding/` (`logo.png`, `favicon.ico`, dan `favicon-32x32.png`).
  * Integrasi logo syarikat rasmi di seluruh paparan: Halaman Login Admin, Welcome/Role Selection screen, Header Utama, Dashboard Admin (Sidebar Brand Card), dan Halaman Search Dispatch.
  * Penambahan nama penuh sistem "Mawar Teraju Commission Management System" di bawah logo pada panel utama.
  * Penyediaan struktur cetakan bertema (Print View) automatik menerusi CSS `@media print` dan elemen kontainer `print-only-header` dengan tarikh cetakan dinamik.
  * Pemformatan eksport PDF rasmi dengan bar warna identiti Maroon (Laporan Komisen) dan Gold (Butiran Potongan).
* **Suite Ujian Regresi Ditambah Baik**:
  * Peningkatan suite ujian `test_runner.html` kepada 13 kes ujian automatik termasuk ujian CRUD batch, pengesah Excel, dan percantuman data carian IC (dual merge).

### Ditambah Baik (Changed)
* **Penukaran Jenis Kunci Status Aktif**: Menukarkan jenis data bendera `active` dalam IndexedDB dari Boolean kepada Integer (`1`/`0`) bagi menyelesaikan isu ketidakserasian kunci indeks IndexedDB pada pelayar web standard.
* **Tema Warna Korporat**: Mengubah suai pemboleh ubah `:root` CSS kepada Maroon (`#8E1B32`) dan Gold (`#D4AF37`/`#B89324`) untuk menyelaraskan dengan identiti korporat syarikat.

---

## [1.0.0] - 2026-07-06

### Selesai (Added)
* **Modularisasi app.js**: Fail `app.js` bersaiz besar (1,238 baris) telah dipecahkan kepada fail modul kecil berasaskan Single Responsibility:
  * `ui.js`: Pengurusan visual DOM, notifikasi toast, kawalan mod tetingkap modal, dan sistem cache DOM.
  * `router.js`: Pengurusan penghalaan berasaskan hash URL dan kawalan kebenaran akses.
  * `dispatch.js`: Pengurusan borang semakan, pemformatan automatik input IC, dan penyediaan kad hasil carian.
  * `admin.js`: Pengurusan sesi pentadbiran, eksport/import fail backup JSON, dan kawalan sistem pembersihan pangkalan data.
  * `upload.js`: Penyediaan acara seret-dan-lepas fail Excel, pautan SheetJS parser, semakan amaran skema lajur, dan import batch.
  * `dashboard.js`: Pemuatan petunjuk statistik dashboard dan operasi rollback fail muat naik.
* **Sistem Caching DOM**: Pengenalan utiliti `DomCache.get(id)` dalam `ui.js` untuk meminimumkan pertanyaan DOM berulang dan meningkatkan kelajuan render.
* **Suite Ujian Regresi (`test_runner.html`)**: Halaman suite ujian regresi asinkronus untuk membolehkan pengesahan modul-modul (DB, Auth, Excel, Router, UI, ErrorHandler) sebelum dilancarkan ke sistem pengeluaran.
* **Penjana Log Ralat Berpusat (`ErrorHandler`)**: Menangkap ralat global dan ralat asinkronus (unhandled rejections) dan menyimpannya secara automatik ke IndexedDB audit log.

### Ditambah Baik (Changed)
* **Pendaftaran Event Listener Tunggal**: Memperkenalkan bendera (flags) pengesanan bagi memastikan acara seperti `hashchange`, event click logo, drag-and-drop, dan format IC hanya didaftarkan tepat sekali semasa aplikasi dibuka.
* **Penamaan camelCase Standard**: Menukar fungsi bukan camelCase seperti `searchByIC` -> `searchByIc` dan `deleteRecordsByIC` -> `deleteRecordsByIc` dalam fail `db.js` dan `excel.js` sambil menyediakan alias sokongan ke belakang.
* **Pengecilan Saiz app.js**: Mengurangkan saiz fail `app.js` sebanyak 81% (dari 47KB/1238 baris ke 9KB/313 baris).

---

## [0.1.0] - 2026-07-06

### Selesai (Added)
* **Prototaip Asal Monolitik**: Aplikasi dibina dengan semua logik penghalaan, pemprosesan Excel, carian pangkalan data, dan pengurusan modal berada di dalam fail tunggal `app.js`.
* **Penyediaan Asas**: Fail `auth.js` (kata laluan lalai `mawar123`), `db.js` (skema pangkalan data IndexedDB versi 2), `excel.js` (parser SheetJS), dan antara muka `index.html` berserta reka bentuk `styles.css`.
