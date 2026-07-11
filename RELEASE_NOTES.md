# Nota Keluaran (Release Notes) - Enterprise Light Theme v1.2.0-beta

Dokumen ini memperincikan status kesediaan komponen sistem, had-had semasa, serta komponen tertangguh yang akan diselesaikan pada Sprint akan datang.

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

## 1. Modul yang Siap (Ready Modules)

### A. Seni Bina Front-End Frozen (UI v1.2.0-beta)
*   **Enterprise Light Theme**: Antaramuka korporat putih/off-white (`#F8FAFC`, `#FFFFFF`) dengan kontras tinggi (Slate 900 `#0F172A`), sempadan lembut `#CBD5E1`, dan menggunakan Maroon `#8E1B32` serta Gold `#D4AF37` sebagai aksen utama. 100% WCAG AA compliant.
*   **Penerapan Design System**: Semua komponen visual (kad, jadual, input, navigasi, badge, dan modal) dipautkan terus kepada pemboleh ubah `:root` CSS (Design Tokens) tanpa sebarang warna hardcoded.
*   **Dual PDF Reports**: Muat turun berasingan bagi Laporan Komisen (Tema Maroon) dan Butiran Potongan (Tema Gold) dengan kontras tinggi.

### B. Abstraksi Repository & Skema Pangkalan Data (v4)
*   **Repository/Service Pattern**: Penstrukturan storan berasaskan interface `CommissionRepository` bagi memisahkan frontend daripada enjin database fizikal.
*   **IndexedDB v4 Relational Schema**: Menambah store `dispatcher_mappings` untuk memetakan dispatcher_id kepada nombor IC, menyokong carian dispatcher relational join.
*   **Atomic Batch Import & Transaction Rollback**: Keseluruhan proses import fail Excel (komisen dan potongan) ditulis dalam satu transaksi database dengan pembatalan (abort transaction) automatik jika berlaku sebarang kegagalan.

### C. Enjin Import Pasif (Passive Cell Extraction)
*   **Excel as Single Source of Truth**: Data dibaca secara pasif terus daripada sel Excel yang dihitung oleh formula Kewangan (Finance), menghapuskan pengiraan formula aktif dalam Javascript serta menjamin kekebalan sistem terhadap perubahan formula/kadar komisen di masa hadapan.

---

## 2. Modul Belum Siap (Pending Modules - Sprint 3)

Modul-modul ini ditangguhkan untuk pembangunan Backend Foundation dalam Sprint 3:
1.  **Migrasi Pangkalan Data Awan (PostgreSQL)**: Menyediakan skrip migrasi SQL dan pool koneksi PostgreSQL tempatan untuk menyimpan data batch secara terpusat.
2.  **API REST (Node.js & Express)**: Membina endpoint pelayan tempatan untuk mengurus sesi pentadbir, muat naik batch komisen, dan carian dispatcher.
3.  **Pengerasan Pengesahan (JWT & bcrypt)**: Menyediakan token JWT untuk mengawal akses endpoint pentadbir dan hashing kata laluan admin dengan bcrypt.
4.  **Role-Based Access Control (RBAC)**: Menyokong pembahagian peranan pengguna (Admin, Rider/Dispatch) bagi menyekat akses data yang tidak sah.
5.  **Penyetempatan Pustaka (Offline-First Packages)**: Memindahkan SheetJS, Lucide, dan jsPDF ke pakej NPM (node_modules) bagi membolehkan aplikasi beroperasi tanpa internet.
