# Nota Keluaran (Release Notes) - Production-Ready Hardened Backend v1.3.0

Dokumen ini memperincikan status kesediaan komponen sistem, had-had semasa, serta komponen keselamatan yang telah diselesaikan pada Sprint 2 & 3.

---

## Rumusan Projek (Project Summary)

| Parameter | Maklumat |
| :--- | :--- |
| **Versi Semasa (Current Version)** | `v1.3.0` |
| **Status Semasa (Current Status)** | Production-Ready Hardened Backend & UI Frozen |
| **Kemajuan Keseluruhan (Overall Progress)** | **100%** |
| **Jumlah Modul Siap (Total Modules)** | **17 Modul** (Teras Klien, Repository/Service Pattern, DB v4, Passive Excel Validator, Eksport PDF, Print Styles, Enterprise Light Theme, Express REST API, PostgreSQL, Rate Limiting, JWT Auth, SHA-256 Refresh Hashing, Security Audit Logging, Password Complexity Policy) |
| **Modul Belum Siap (Pending Modules)** | **None** |
| **Status Ujian (Test Status)** | **Lulus Cemerlang** (13 Ujian Regresi Automatik Klien PASS + 8 Ujian Integrasi Keselamatan Backend PASS) |
| **Tarikh Kemas Kini (Last Updated)** | 2026-07-12 |

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

### D. Hardened Backend Foundation & Security Enhancement (v1.3.0)
*   **Pangkalan Data PostgreSQL Berpusat**: Skema pangkalan data SQL berpusat menggunakan standard UUID (`gen_random_uuid()`) untuk semua kunci utama (users, user_refresh_tokens, audit_logs).
*   **Pengerasan JWT & Token Hashing**: Menggunakan separate `JWT_SECRET` dan `JWT_REFRESH_SECRET` env variables. Token refresh disimpan secara selamat menggunakan cincangan SHA-256.
*   **Audit Logging**: Jadual `audit_logs` dan `auditLogService` yang merekodkan logins (berjaya/gagal), logout, refresh token, dan invalid JWT.
*   **Specific Rate Limiting**: Pembatasan kadar requests yang dispesifikasikan per-laluan (`loginLimiter` 5 req/min, `searchLimiter` 100 req/min, `uploadLimiter` 20 req/min, `adminLimiter` 60 req/min).
*   **Polisi Keselamatan Kata Laluan**: Menguatkuasakan had minimum 12 aksara, penggunaan huruf besar, huruf kecil, angka, dan simbol khas menggunakan validator `express-validator`.
*   **Helmet CSP & Cookies Standard**: HTTP-only, secure, sameSite strict flags untuk cookies dan dasar Content Security Policy (CSP) dari Helmet.

---

## 2. Modul Belum Siap (Pending Modules)
*   **None** (Semua komponen reka bentuk fasa REST API, PostgreSQL, Rate Limiting, JWT Auth, dan Local Node Packages telah diselesaikan).
