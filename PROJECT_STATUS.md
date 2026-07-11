# Status Semasa Projek (Project Status)

Dokumen ini menyediakan rumusan status pembangunan terkini bagi Commission Lookup System.

---

## Rumusan Projek (Project Summary)

| Parameter | Maklumat |
| :--- | :--- |
| **Versi Semasa (Current Version)** | `Enterprise Light Theme v1.2.0-beta` |
| **Status Semasa (Current Status)** | UI Frozen / API & DB Integration |
| **Kemajuan Keseluruhan (Overall Progress)** | **`±90%`** |
| **Jumlah Modul Siap (Total Modules)** | **11 Modul** (Teras Klien, Repository/Service Pattern, DB v4, Passive Excel Validator, Eksport PDF, Print Styles, Enterprise Light Theme) |
| **Modul Belum Siap (Pending Modules)** | **5 Modul** (REST API, PostgreSQL, Rate Limiting, JWT Auth, Local Node Packages) |
| **Status Ujian (Test Status)** | **Lulus Cemerlang** (13 / 13 Ujian Regresi Automatik PASS) |
| **Tarikh Kemas Kini (Last Updated)** | 2026-07-11 |

---

## 1. Rumusan Status Pembangunan
*   **Peratusan Siap**: **90%** (Seni Bina Klien decoupled, Repository/Service Pattern abstraction, DB v4, Carian Komisen & Potongan, Penstandardan Passive Excel Extraction Selesai, Enterprise Light Theme v1.2.0-beta Selesai. Storan awan & backend belum siap).
*   **Kesihatan Sistem**: Cemerlang (13 Kes Ujian Regresi Lulus 100%).
*   **Versi Semasa**: `Enterprise Light Theme v1.2.0-beta`

---

## 2. Status Modul Sistem (Client-Side)

| Nama Modul | Kategori | Status | Peratusan Siap | Penerangan |
| :--- | :--- | :--- | :--- | :--- |
| **Pangkalan Data (`db.js`)** | Teras | Selesai | 100% | IndexedDB v4, Repository/Service Abstraction, simpanan passive computed values, transactional rollback. |
| **Pengesahan Excel (`excel.js`)** | Teras | Selesai | 100% | Pemetaan lajur Excel dinamik berasingan, passive cell extraction (Excel single source of truth), Master Mapping extraction. |
| **Sistem UI (`ui.js`)** | Visual | Selesai | 100% | Toast, modal, render ikon, dan cache DOM. |
| **Sistem Routing (`router.js`)** | Teras | Selesai | 100% | Pengurusan view state & auth gate Admin. |
| **Pencarian IC (`dispatch.js`)** | Rider | Selesai | 100% | Carian gabungan (dual merge), format NRIC, eksport PDF berasingan (Maroon/Gold), detailed penalties. |
| **Fungsi Admin (`admin.js`)** | Admin | Selesai | 100% | Backup, restore, wipe, dan tukar kata laluan. |
| **Import & Upload (`upload.js`)** | Admin | Selesai | 100% | Consolidated file auto-fill, transactional save with abort rollback. |
| **Analitis Dashboard (`dashboard.js`)**| Admin | Selesai | 100% | Statistik batch aktif, rollback batch, history table. |
| **Ujian Regresi (`test_runner.html`)**| Ujian | Selesai | 100% | 13 ujian regresi automatik (skema migration, rollback, UAT passive cell mapping). |
| **Branding & Print View** | Visual | Selesai | 100% | Light Corporate Theme (Maroon & Gold accents, off-white background, high contrast slate text, favicon, logo rasmi, print stylesheet, 100% WCAG AA compliant accessibility audit). |

---

## 3. Had-had Sistem Semasa (Known Limitations)
1.  **Storan Terasing (No Cloud Sync)**: Data disimpan dalam IndexedDB pelayar setempat peranti Admin. Tiada perkongsian data automatik antara peranti tanpa backup manual.
2.  **Ketiadaan Pengerasan Auth (No Stretched Auth)**: Kata laluan admin disemak di bahagian klien (insecure terhadap manipulasi script DOM / Inspect Element).
3.  **Had Kadar Carian NRIC**: Rider boleh membuat carian Kad Pengenalan secara brute-force tanpa halangan rate limiter pelayan.
4.  **Kebergantungan Internet (CDN)**: SheetJS, Lucide, dan jsPDF dipanggil daripada CDN luaran, memerlukan talian internet aktif.

---

## 4. Pelan Tindakan Sprint 2 (Sprint 2 - Backend & Database Migration)

Sprint 2 akan menumpukan kepada pembangunan server-side dan migrasi pangkalan data awan untuk persediaan go-live:

### A. Objektif Utama
Mewujudkan sistem simpanan komisen berpusat awan untuk membenarkan akses pentadbir dari mana-mana peranti dan meningkatkan keselamatan maklumat NRIC rider.

### B. Skop Pembangunan
*   **Storan Awan PostgreSQL**: Menyediakan pengurusan pangkalan data SQL berpusat.
*   **Express REST API**: Membina endpoint pelayan Node.js / Express untuk carian rider dan muat naik admin.
*   **Pengerasan Keselamatan (Auth)**: Menyediakan JWT token dan hashing kata laluan kriptografi (bcrypt) di backend.
*   **Had Kadar Carian (Rate Limiting)**: Menyekat cubaan carian IC dispatcher secara pukal.

### C. Deliverables
*   Skrip migrasi PostgreSQL SQL Schema.
*   Servis REST API Express Server (kod Node.js).
*   Sijil SSL/HTTPS staging & production deployment.
*   Garis panduan bundler npm (offline-first).
