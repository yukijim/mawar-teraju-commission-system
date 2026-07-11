# Environment Setup & Configuration Guide

Dokumen ini menyediakan panduan langkah demi langkah untuk menyediakan persekitaran pembangunan tempatan (local development setup) bagi backend Express dan PostgreSQL.

---

## 1. Keperluan Sistem (System Prerequisites)

Sila pastikan perisian berikut telah dipasang sebelum memulakan setup:
*   **Node.js**: Versi 18 LTS atau lebih tinggi.
*   **NPM**: Dipasang bersama Node.js.
*   **PostgreSQL**: Versi 15 atau lebih tinggi.
*   **Git**: Untuk clone dan kawalan kod.

---

## 2. Pemboleh Ubah Persekitaran (`.env.example`)

Bina fail `.env` di dalam root folder backend berasaskan templat di bawah:

```ini
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Connection Pool Configuration
# Ganti dengan user, password dan database name mesin anda
DB_USER=postgres
DB_PASSWORD=mawar_secure_db_pass
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mawar_teraju_comm

# JWT Authentication Config
# Gunakan rentetan rahsia yang panjang dan unik untuk pengeluaran (production)
JWT_SECRET=super_secret_mawar_key_change_me_in_production_998811
JWT_EXPIRES_IN=12h

# Security Rate Limiter (Carian Dispatcher)
RATE_LIMIT_WINDOW_MINUTES=5
RATE_LIMIT_MAX_REQUESTS=15

# CORS Allowed Origin
# Benarkan domain front-end tempatan/pengeluaran memanggil API
ALLOWED_CORS_ORIGIN=http://localhost:9999
```

---

## 3. Langkah Pemasangan & Persediaan (Setup Steps)

### Langkah 1: Pasang Dependencies Backend
Jalankan arahan berikut di dalam folder root projek untuk memasang perpustakaan Node:
```bash
npm install
```

### Langkah 2: Sediakan Fail Pemboleh Ubah `.env`
Salin templat konfigurasi dan sesuaikan pemboleh ubah dengan persekitaran sistem anda:
```bash
cp .env.example .env
```

### Langkah 3: Sediakan Pangkalan Data PostgreSQL
1.  Buka shell PostgreSQL atau aplikasi pgAdmin, dan cipta database kosong:
    ```sql
    CREATE DATABASE mawar_teraju_comm;
    ```
2.  Jalankan skrip migrasi jadual (DDL):
    ```bash
    psql -U postgres -d mawar_teraju_comm -f database/schema.sql
    ```
3.  Jalankan skrip seed data untuk menjana akaun admin permulaan:
    ```bash
    psql -U postgres -d mawar_teraju_comm -f database/seed.sql
    ```

### Langkah 4: Jalankan Pelayan Backend
*   **Mod Pembangunan (Development)**:
    Menjalankan pelayan dengan hot-reloading (automatik restart apabila kod berubah):
    ```bash
    npm run dev
    ```
*   **Mod Pengeluaran (Production)**:
    Menjalankan pelayan pengeluaran yang dioptimumkan:
    ```bash
    npm start
    ```
