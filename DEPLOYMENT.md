# PANDUAN DEPLOYMENT & KESEDIAAN PENGELUARAN (VPS Deployment Guide)

Dokumen ini memperincikan panduan pelancaran sistem ke persekitaran pengeluaran Ubuntu VPS, merangkumi pangkalan data PostgreSQL, pengurusan PM2, konfigurasi Nginx reverse proxy, Cloudflare SSL, dasar sandaran (backup retention), ujian pemulihan (restore tests), pemantauan diagnostik, dan smoke testing.

---

## 1. Seni Bina Deployment VPS (Ubuntu 22.04 LTS)

Sistem komisen dihoskan menggunakan Nginx sebagai reverse proxy untuk menyalurkan trafik HTTPS selamat ke pelayan aplikasi Node.js Express yang diuruskan oleh PM2 cluster.

```text
  [ Client Browser / HTTPS ]
              │
              ▼
       [ Cloudflare DNS ] (SSL/TLS Full Proxy)
              │
              ▼
      [ Nginx Reverse Proxy ] (Port 443 / SSL Terminated)
              │
              ├── /api -> Proxy Pass -> [ PM2 Node Cluster ] (Port 5000)
              └── /    -> Serve Static -> [ Frozen HTML/CSS/JS Assets ]
```

---

## 2. Langkah-Langkah Deployment

### A. Persediaan Node.js & PM2
1. Pasang Node.js v22 LTS pada Ubuntu VPS:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. Pasang PM2 secara global:
   ```bash
   sudo npm install -g pm2
   ```
3. Konfigurasikan aplikasi PM2 menggunakan file [ecosystem.config.js](file:///c:/_MT%20Sistem%20Com/backend/ecosystem.config.js):
   ```bash
   cd /opt/mawar-teraju/backend
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

### B. Persediaan PostgreSQL & Migrasi Jadual
1. Pasang PostgreSQL 15/16 di Ubuntu:
   ```bash
   sudo apt-get install -y postgresql postgresql-contrib
   ```
2. Akses CLI PostgreSQL untuk mencipta pangkalan data:
   ```bash
   sudo -i -u postgres psql
   # Di dalam psql console:
   CREATE DATABASE mawar_teraju_commission;
   CREATE USER mawar_admin WITH PASSWORD 'SecurePassword@12345';
   GRANT ALL PRIVILEGES ON DATABASE mawar_teraju_commission TO mawar_admin;
   \q
   ```
3. Jalankan fail-fail skrip migrasi SQL mengikut turutan:
   ```bash
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f database/migrations/001_create_users_table.sql
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f database/migrations/002_create_commission_and_deductions_tables.sql
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f database/migrations/003_add_enterprise_batch_columns.sql
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f database/migrations/004_create_search_history_table.sql
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f database/migrations/005_search_hardening_indexes.sql
   ```
4. Seed akaun Pentadbir Asal (Admin Seeding):
   Sediakan pemboleh ubah persekitaran `.env` terlebih dahulu, kemudian jalankan skrip seed:
   ```bash
   node database/seed.js
   ```

### C. Fail Konfigurasi Persekitaran (`.env`)
Sediakan fail `/opt/mawar-teraju/backend/.env` seperti contoh berikut:
```env
PORT=5000
NODE_ENV=production

# Database Settings
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=mawar_teraju_commission
DATABASE_USER=mawar_admin
DATABASE_PASSWORD=SecurePassword@12345

# Security Settings
JWT_SECRET=super_secure_jwt_access_secret_long_string_12345
JWT_REFRESH_SECRET=super_secure_jwt_refresh_secret_long_string_54321

# Default Admin Credentials for Seeding
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456789
```

### D. Konfigurasi Nginx
1. Salin fail konfigurasi [nginx.conf](file:///c:/_MT%20Sistem%20Com/backend/nginx.conf) ke `/etc/nginx/sites-available/semak.reekod.com`.
2. Aktifkan konfigurasi dan muat semula Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/semak.reekod.com /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### E. Cloudflare DNS & SSL Setup
1. Tambah rekod **A** di Cloudflare DNS yang memadankan subdomain `semak.reekod.com` ke IP VPS anda.
2. Aktifkan butang **Proxy status (Orange Cloud)** Cloudflare untuk perlindungan DDoS dan CDN caching.
3. Di tab SSL/TLS Cloudflare, set mod enkripsi kepada **Full (strict)**.
4. Pasang Let's Encrypt SSL di VPS menggunakan Certbot untuk enkripsi hujung-ke-hujung yang sah:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d semak.reekod.com
   ```

---

## 3. Dasar Sandaran & Pemulihan (Backups & Restore Policy)

### A. Backup Utama (pg_dump & Off-site Replication)
Sistem menggunakan skrip [backup.sh](file:///c:/_MT%20Sistem%20Com/backend/scripts/backup.sh) untuk melakukan sandaran harian secara automatik.
- **pg_dump**: Mengambil salinan struktur pangkalan data secara penuh dan mampat ke fail `.sql.gz`.
- **Retention Policy**: Sistem mengekalkan fail sandaran harian selama **30 hari** secara lokal. Fail yang berusia melebihi 30 hari akan dipadam secara automatik (`find -mtime +30`).
- **Off-site Copy**: Fail sandaran disalin ke storan luar VPS (seperti AWS S3 atau pelayan FTP selamat) bagi mengelakkan kehilangan data sekiranya VPS mengalami kegagalan fizikal.
- **Pihak Ketiga Fallback**: Custom SQL Exporter backend (`POST /api/v1/admin/backup`) dikekalkan sebagai sokongan backup tambahan sahaja.

### B. Ujian Pemulihan (Restore Verification Test)
Untuk memastikan integriti fail sandaran, ujian pemulihan mestilah dijalankan sekurang-kurangnya sekali sebulan pada pelayan staging:
```bash
# 1. Cipta DB sementara untuk restore test
createdb -h localhost -U postgres restore_test_db

# 2. Nyah-mampat fail backup harian dan masukkan ke DB restore test
gunzip -c /var/backups/mawar-teraju/db_backup_YYYY-MM-DD.sql.gz | psql -h localhost -U postgres -d restore_test_db

# 3. Jalankan semakan rekod ringkas bagi mengesahkan data
psql -h localhost -U postgres -d restore_test_db -c "SELECT COUNT(*) FROM users;"
```

---

## 4. Pemantauan & Diagnostik Kesihatan (Monitoring System)

Sistem pemantauan diagnostik boleh diakses oleh pentadbir melalui `GET /api/v1/admin/monitor` dengan maklum balas status kesihatan:
- **OK**: Sistem berjalan lancar tanpa amaran.
- **WARNING**: Sistem menghadapi isu tidak kritikal:
  - Latency database melebihi **100ms** (Database Latency Alert).
  - Ruang cakera bebas (free disk space) kurang daripada **15%** (Disk Usage Alert).
  - Penggunaan memori heap Node.js melebihi **80%**.
- **CRITICAL**: Pangkalan data gagal disambungkan sama sekali (Database Connection Failure).

---

## 5. Smoke Testing (Post-Deployment Check)

Selepas setiap deployment baru selesai:
1. Jalankan skrip smoke test untuk mengesahkan kestabilan endpoint aplikasi:
   ```bash
    SMOKE_HOST="semak.reekod.com" SMOKE_PORT="443" node backend/scripts/smoke.js
   ```
2. Skrip akan memaparkan kod status dan metadata ping. Jika jawapan mengandungi `status: "ok"`, deployment dianggap lulus dan sedia untuk kegunaan pengeluaran.
