# Backend Production Architecture - Mawar Teraju Commission System

Seni bina backend dibangunkan berasaskan prinsip **Business-First Architecture** dan **Clean Architecture** (pemisahan kebimbangan - *Separation of Concerns*). Seni bina ini mengekalkan corak abstraksi Repository/Service yang sedia ada di bahagian front-end bagi memudahkan migrasi storan yang telus.

---

## 1. Struktur Folder Projek (Directory Structure)

Penyusunan fail diuruskan di bawah folder `src/` untuk pemisahan fungsian modular yang kemas:

```text
/
├── src/
│   ├── config/             # Konfigurasi sistem (database pool, env loader)
│   │   ├── database.js     # pg-pool connection config
│   │   └── variables.js    # Env variables loader & validation
│   │
│   ├── routes/             # Endpoints routing
│   │   ├── auth.js         # /api/auth/* routes
│   │   ├── batches.js      # /api/batches/* routes
│   │   ├── dispatch.js     # /api/dispatch/* routes
│   │   └── audit.js        # /api/admin/audit-logs/* routes
│   │
│   ├── controllers/        # Pengendali HTTP (Request/Response logic)
│   │   ├── authController.js
│   │   ├── batchController.js
│   │   ├── dispatchController.js
│   │   └── auditController.js
│   │
│   ├── middleware/         # Express custom middlewares
│   │   ├── auth.js         # JWT Token verifier & RBAC guard
│   │   ├── error.js        # Centralized error handler
│   │   └── rateLimiter.js  # API request rate limiter
│   │
│   ├── services/           # Logik Perniagaan (Business Logic & Validation)
│   │   ├── authService.js      # Password hashing (bcrypt) & JWT signing
│   │   ├── excelService.js     # Passive excel parser (SheetJS server-side)
│   │   └── commissionService.js# Aggregation & verification
│   │
│   ├── repositories/       # Lapisan Storan (Data Access Layer - SQL)
│   │   ├── baseRepository.js   # Repository interface declaration
│   │   ├── pgRepository.js     # PostgreSQL repository implementation
│   │   └── auditRepository.js  # Audit log persistence
│   │
│   ├── app.js              # Express app initialization (Middlewares binding)
│   └── server.js           # Server starter (Port binding & process handling)
│
├── tests/                  # Suite Ujian Automatik
│   ├── integration/        # API Integration tests
│   ├── unit/               # Service & validation tests
│   └── setup.js            # Test database migrations loader
│
├── database/               # Skrip database SQL
│   ├── schema.sql          # Migrasi DDL (Jadual & index)
│   └── seed.sql            # Seed data permulaan (default admin)
│
├── .env.example            # Templat Environment variables
├── package.json            # Node.js dependencies
└── README.md
```

---

## 2. Aliran Data Perniagaan (Architectural Data Flow)

Sistem ini membahagikan logik pemprosesan data kepada empat lapisan utama:

1.  **Lapisan Routing & Middleware**:
    *   Menerima HTTP Request daripada front-end.
    *   Menguji keselamatan (Rate-limiting, CORS, JWT Verification).
    *   Menguruskan kebenaran peranan (RBAC check).
2.  **Lapisan Controller**:
    *   Menghurai parameter input (payload body, query parameters).
    *   Memanggil service layer yang bersesuaian.
    *   Mengembalikan standard JSON response dan HTTP status code.
3.  **Lapisan Service (Business Logic)**:
    *   Menjalankan logik perniagaan (contoh: memproses fail Excel secara pasif menggunakan SheetJS, mengira agregat dwi-laporan).
    *   Menguatkuasakan pengesahan skema fail komisen (13 lajur) dan potongan (9 lajur).
    *   Mencetus log audit keselamatan secara automatik bagi setiap aktiviti kritikal.
4.  **Lapisan Repository (Data Access)**:
    *   Menyediakan fungsi CRUD secara langsung ke PostgreSQL menggunakan SQL query.
    *   Mengurus transaksi database secara atomik (`BEGIN`, `COMMIT`, `ROLLBACK`) untuk membolehkan auto-rollback data batch jika berlaku kegagalan parsing fail.

---

## 3. Komponen Utama Pustaka (Tech Stack Dependencies)

*   **Runtime**: Node.js v18 LTS
*   **Web Framework**: Express.js (ringan, pantas, standard industri)
*   **Database Driver**: `pg` (PostgreSQL client pool driver)
*   **Authentication**: `jsonwebtoken` (JWT tokens)
*   **Encryption**: `bcryptjs` (Hashing kata laluan kriptografi)
*   **Excel Engine**: `xlsx` (SheetJS untuk server-side parsing)
*   **Upload Handler**: `multer` (Pengurusan streaming fail excel)
