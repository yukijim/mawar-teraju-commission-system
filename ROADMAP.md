# Hala Tuju Pembangunan (Roadmap)

Dokumen ini merumuskan perancangan fasa pembangunan sistem bagi jangka masa pendek dan panjang.

---

## Fasa 1: Pembersihan Seni Bina & Penstandardan Visual (Selesai - Julai 2026)
*   **Modularisasi Javascript**: Memecah fail monopoli `app.js` kepada modul modular (`ui.js`, `router.js`, `dispatch.js`, `admin.js`, `upload.js`, `dashboard.js`), mendaftar event listener tunggal, pengesahan fail Excel dinamik, caching DOM penuh, dan penyediaan suite ujian regresi asinkronus.
*   **Reka Bentuk Enterprise & Aksesibiliti**: Penstandardan antaramuka menggunakan tema terang korporat (`Enterprise Light Theme v1.2.0-beta`). 100% WCAG AA compliant. Tiada warna hardcoded dan semua inline styles dibersihkan (Problems = 0).
*   **Enjin Import Pasif**: Menghapuskan formula aktif JS dan menetapkan Excel sebagai *single source of truth* pasif.

---

## Fasa 2: Seni Bina Backend & Pangkalan Data (Sprint 3)
*   **Sprint 3A - Seni Bina Pengeluaran (Selesai)**:
    *   [x] Merekabentuk struktur folder, API Contract RESTful, skema database PostgreSQL, dan security model (JWT/RBAC).
    *   [x] Menyediakan dokumentasi lengkap: `BACKEND_ARCHITECTURE.md`, `API_CONTRACT.md`, `DATABASE_SCHEMA.md`, `SECURITY_ARCHITECTURE.md`, `DEPLOYMENT_ARCHITECTURE.md`, dan `ENVIRONMENT_SETUP.md`.
*   **Sprint 3B - Implementasi Backend (Akan Datang)**:
    *   [ ] Pemasangan Node.js, Express, dan PostgreSQL secara tempatan.
    *   [ ] Membina endpoints REST API, JWT authentication logic, dan server-side passive Excel parsing.
    *   [ ] Menjalankan API integration tests, transaction database rollback tests, dan UAT validation.

---

## Fasa 3: Modularisasi CSS & Pengemasan Clean Code (Sprint 4)
*Sasaran: Selepas Implementasi Backend Selesai*
*   [ ] **Modular CSS Stylesheets**: Memecah fail monopoli `styles.css` kepada unit stylesheet modular untuk meningkatkan penyenggaraan tanpa mengubah UI sedia ada:
    *   `variables.css` (Design system tokens, warna, spacing, shadows)
    *   `layout.css` (Grid, flex containers, view structures)
    *   `buttons.css` (Primary, secondary, danger button hierarchy)
    *   `forms.css` (Inputs, focus states, validation states)
    *   `tables.css` (Zebra rows, header headers, scroll layouts)
    *   `cards.css` (SaaS style cards, hover interactions)
    *   `dashboard.css` (Stats metrics cards layout)
    *   `search.css` (Dispatcher search results blocks layout)
    *   `upload.css` (Drag and drop compact upload zone styling)
    *   `modal.css` (Popup modal panels styling)
    *   `print.css` (Official print invoice layout overrides)
    *   `responsive.css` (Mobile/tablet media queries)

---

## Fasa 4: Automasi & Penyelenggaraan Pintar (Fasa Masa Depan)
*   [ ] **Pengecaman Fail Excel Pintar**: Menggunakan algoritma pemetaan jarak teks untuk memetakan nama lajur fail Excel tersuai kepada 20 skema standard secara automatik tanpa bergantung pada alias statik.
*   [ ] **Pemantauan Masa Nyata (Real-time Audit Trace)**: Integrasi dengan perkhidmatan pemantauan ralat (seperti Sentry) untuk menangkap ralat JS di komputer pelanggan secara langsung.
