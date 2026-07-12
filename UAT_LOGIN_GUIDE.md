# UAT LOGIN GUIDE - REEKOD SEMAK v1.0.0-rc1

> [!IMPORTANT]
> **STATUS: Pending VPS Deployment**
> 
> Pemasangan dan deployment fungsian ke pelayan Ubuntu VPS pengeluaran masih berada di peringkat penyediaan oleh pihak pentadbir sistem. Sila lengkapkan langkah deployment yang diperincikan di bawah untuk mengaktifkan portal dan mendapatkan URL serta kredensial log masuk pengeluaran sebenar.

---

## 1. Langkah Pengaktifan Perkhidmatan di VPS (Deployment Steps)

Untuk menukar status perkhidmatan kepada aktif, jalankan langkah berikut pada terminal SSH Ubuntu VPS anda:

### Langkah A: Memuat Turun Kod & Memasang Dependency
```bash
# Clone atau tarik kod terkini dari branch main
git checkout main
git pull origin main

# Pemasangan dependency pengeluaran sahaja
cd backend
npm ci --only=production
```

### Langkah B: Jalankan Migrasi & Seeding Database
Jalankan migrasi pangkalan data mengikut urutan berangka (001–005) pada database production PostgreSQL:
```bash
psql -h localhost -U reekod_admin -d reekod_commission_db -f database/migrations/001_create_users_table.sql
psql -h localhost -U reekod_admin -d reekod_commission_db -f database/migrations/002_create_commission_and_deductions_tables.sql
psql -h localhost -U reekod_admin -d reekod_commission_db -f database/migrations/003_add_enterprise_batch_columns.sql
psql -h localhost -U reekod_admin -d reekod_commission_db -f database/migrations/004_create_search_history_table.sql
psql -h localhost -U reekod_admin -d reekod_commission_db -f database/migrations/005_search_hardening_indexes.sql

# Lakukan seeding kata laluan Admin daripada konfigurasi .env
node database/seed.js
```

### Langkah C: Lancarkan PM2 Server
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### Langkah D: Aktifkan Nginx & Sijil SSL Let's Encrypt
```bash
sudo ln -sf /etc/nginx/sites-available/semak.reekod.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Memperoleh sijil SSL selamat
sudo certbot --nginx -d semak.reekod.com
```

---

## 2. Senarai Semak Verifikasi Runtime VPS (Verification Checklist)

Selepas deployment selesai, jalankan perintah diagnostik berikut di VPS untuk mengumpul bukti (evidence):

### A. Semak Status PM2 Cluster
```bash
pm2 status
```
*(Pastikan status `reekod-commission-backend` memaparkan lajur `online`)*.

### B. Semak Status Nginx
```bash
sudo systemctl status nginx
```
*(Sahkan Nginx berstatus `active (running)`)*.

### C. Semak Endpoint Kesihatan REST API
```bash
curl -i https://semak.reekod.com/api/health
```
*(Hasil respon mestilah mengandungi status `200 OK` dengan payload JSON `{"status":"ok","database":"connected"}`)*.

### D. Ujian Asap Post-Deployment (Smoke Testing)
Jalankan ujian ping automatik:
```bash
SMOKE_HOST="semak.reekod.com" SMOKE_PORT="443" node scripts/smoke.js
```

---

## 3. Kredensial Ujian Pengeluaran (Menunggu Konfigurasi .env)

*Sila kemas kini kredensial di bawah sebaik sahaja kata laluan production telah dikunci masuk dalam `.env`:*

- **Portal URL**: `https://semak.reekod.com`
- **Admin Username**: `admin`
- **Admin Password**: *(Ditakrifkan di dalam `DEFAULT_ADMIN_PASSWORD` pada `.env` pengeluaran)*
- **Dispatch Username**: `NSN3052004`
- **Dispatch Password**: *(Ditakrifkan di dalam pangkalan data staging)*
