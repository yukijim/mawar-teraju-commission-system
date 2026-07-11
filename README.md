# Commission Lookup System (Mawar Teraju)

Sistem Carian Komisen Modular untuk pengurusan dan semakan data komisen rider/dispatch Mawar Teraju secara production-ready.

> [!IMPORTANT]
> **UI Frozen - Versi UI Enterprise Light Theme v1.2.0-beta**
> Kerja-kerja pembangunan bahagian hadapan (client-side), abstraksi Repository/Service, skema database IndexedDB v4, enjin import pasif (UAT-compatible), dan penstandardan branding korporat terang (Enterprise Light Theme) telah selesai sepenuhnya.

---

## Rumusan Projek (Project Summary)

| Parameter | Maklumat |
| :--- | :--- |
| **Versi Semasa (Current Version)** | `Enterprise Light Theme v1.2.0-beta` |
| **Status Semasa (Current Status)** | UI Frozen / API & DB Integration |
| **Kemajuan Keseluruhan (Overall Progress)** | **±90%** |
| **Jumlah Modul Siap (Total Modules)** | **11 Modul** (Teras Klien, Repository/Service Pattern, DB v4, Passive Excel Validator, Eksport PDF, Print Styles, Enterprise Light Theme) |
| **Modul Belum Siap (Pending Modules)** | **5 Modul** (REST API, PostgreSQL, Rate Limiting, JWT Auth, Local Node Packages) |
| **Status Ujian (Test Status)** | **Lulus Cemerlang** (13 / 13 Ujian Regresi Automatik PASS) |
| **Tarikh Kemas Kini (Last Updated)** | 2026-07-11 |

---

## Ringkasan Projek & Objektif
Sistem ini dibangunkan khas untuk membolehkan pihak pentadbir (Admin) memuat naik data komisen dalam format Excel, mengurus rekod komisen, dan memantau log audit aktiviti. Dispatcher (Rider) boleh menyemak jumlah komisen bersih dan perincian terperinci komisen mereka dengan memasukkan Nombor Kad Pengenalan (IC).

### Objektif Utama:
1.  **Penyimpanan Setempat**: Menguruskan data transaksi komisen rider menggunakan pangkalan data berasaskan penyemak imbas (IndexedDB v4) dengan sokongan sistem batch.
2.  **Semakan Selamat & Pantas**: Membolehkan dispatch menyemak rekod komisen tanpa mendedahkan data dispatcher lain.
3.  **Integriti Data**: Menguatkuasakan pengesahan skema lajur Excel berasingan untuk Komisen (13 lajur) dan Potongan (9 lajur).
4.  **Jejak Audit**: Merekod aktiviti penting (carian, eksport, import, ralat) untuk kawalan keselamatan.

---

## Seni Bina Sistem (Architecture)
Sistem ini beroperasi 100% di bahagian pelanggan (Client-side) untuk kelajuan carian dan kemudahan operasi tanpa pelayan luaran (Serverless) pada fasa semasa (`v1.2.0-beta`).

*   **Frontend**: HTML5, Vanilla CSS, Vanilla Javascript (Standard ES5/ES6 script tags untuk keserasian `file://` protocol), [Lucide Icons](https://lucide.dev) untuk grafik visual.
*   **Excel Parsing**: [SheetJS (XLSX)](https://sheetjs.com) untuk pemprosesan fail Excel di bahagian klien secara pasif (Excel as Single Source of Truth).
*   **Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) menggunakan repository pattern (`IndexedDBRepository`) versi 4 dengan transactional rollback.
*   **Backend**: Node.js, Express & PostgreSQL (Rujuk [API.md](API.md) untuk perancangan pelayan di Sprint 3).

---

## Cara Menjalankan Sistem Secara Tempatan
Sila rujuk [DEPLOYMENT.md](DEPLOYMENT.md) untuk panduan pemasangan dan pelancaran pelayan web tempatan (Python, PowerShell, http-server).

---

## Pautan Dokumentasi Projek
Sila rujuk fail berikut untuk perincian reka bentuk sistem:

*   [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Rangka folder modular dan penerangan fungsi bagi setiap modul.
*   [DATABASE_V2.md](DATABASE_V2.md) - Skema IndexedDB v4, aliran data (Excel → DB), dan peraturan perniagaan.
*   [API.md](API.md) - Reka bentuk konseptual API REST Backend untuk Sprint 2.
*   [DEPLOYMENT.md](DEPLOYMENT.md) - Panduan deployment dan Senarai Semak Kesediaan Go-Live.
*   [ROADMAP.md](ROADMAP.md) - Perancangan ciri-ciri akan datang.
*   [CHANGELOG.md](CHANGELOG.md) - Sejarah versi dan kemas kini.
*   [PROJECT_STATUS.md](PROJECT_STATUS.md) - Status semasa, had, hutang teknikal, dan pelan tindakan Sprint 2.
*   [RELEASE_NOTES.md](RELEASE_NOTES.md) - Modul siap, tertangguh, dan had sistem yang diketahui.

---

## Panduan Identiti Visual & Branding (Branding Guidelines)

Sistem ini mematuhi identiti visual rasmi Mawar Teraju menggunakan tema warna Maroon & Gold berasaskan aset penjenamaan rasmi.

### Warna Penjenamaan (Corporate Colors):
*   **Maroon (Primary)**: `#8E1B32` (Digunakan untuk warna butang utama, header, dan elemen navigasi).
*   **Gold (Accent)**: `#D4AF37` / `#B89324` (Digunakan untuk penanda draf, pautan aktif, butang sorotan, dan aksen laporan).
*   **Latar Terang & Slate (Backgrounds)**: Latar belakang terang korporat (off-white `#f8fafc` & putih `#ffffff`) digabungkan dengan panel bersempadan lembut (`#cbd5e1`) dan teks slate gelap `#0F172A` untuk kebolehbacaan maksimum dan kontras yang tinggi (memenuhi aksesibiliti WCAG AA).

### Aset Rasmi (Official Visual Assets):
Semua aset penjenamaan disimpan secara berpusat di bawah direktori `/assets/images/branding/`:
1.  **Logo Rasmi**: [logo.png](file:///c:/_MT%20Sistem%20Com/assets/images/branding/logo.png) (Logo resolusi tinggi yang dipaparkan pada skrin login, dashboard, sidebar, dan header semakan).
2.  **Favicon**: [favicon.ico](file:///c:/_MT%20Sistem%20Com/assets/images/branding/favicon.ico) dan [favicon-32x32.png](file:///c:/_MT%20Sistem%20Com/assets/images/branding/favicon-32x32.png) untuk paparan tab pelayar web.

*Nota: Sila gunakan logo.png secara berpusat sahaja (elakkan salinan berganda) demi mengekalkan integriti visual sistem.*
