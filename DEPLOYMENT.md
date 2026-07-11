# Panduan Pemasangan & Pengeluaran (Deployment)

Dokumen ini menyediakan panduan lengkap untuk memasang dan menjalankan Commission Lookup System secara tempatan serta panduan pelancaran ke persekitaran pengeluaran (production environment).

---

## 1. Pemasangan & Menjalankan Tempatan (Local Development)

Sistem ini dibina berasaskan fail statik (HTML/CSS/JS) sepenuhnya dan boleh dihoskan menggunakan sebarang pelayan web statik ringkas.

> [!WARNING]
> Membuka fail `index.html` secara terus menggunakan klik berkembar (`file:///` protocol) boleh menyebabkan fungsi penyemak imbas tertentu terhad (contoh: ralat CORS jika menggunakan modul ES masa depan). Adalah amat disyorkan untuk melancarkannya menggunakan pelayan HTTP tempatan.

### Pilihan A: Menggunakan Python (Nasihat Standard)
Jika komputer anda mempunyai Python dipasang, buka terminal (PowerShell/CMD) di dalam direktori projek `c:\_MT Sistem Com` dan jalankan:
```bash
python -m http.server 8081
```
Buka penyemak imbas dan layari: `http://localhost:8081`

### Pilihan B: Menggunakan PowerShell (Tanpa Pasang Program Luar)
Jika anda menggunakan Windows tanpa Node atau Python, anda boleh menggunakan skrip static server PowerShell tersuai yang disediakan di dalam folder projek. Buka PowerShell dan jalankan:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\User\.gemini\antigravity-ide\brain\5199218c-00a2-4318-bf01-199337332d45\scratch\server.ps1"
```
Ini akan melancarkan pelayan di `http://localhost:8081`. Untuk menghentikan pelayan, layari `http://localhost:8081/stop-server`.

### Pilihan C: Menggunakan PHP
Buka terminal di dalam folder projek dan jalankan:
```bash
php -S localhost:8081
```

---

## 2. Pengeluaran (Production Deployment)

Oleh kerana sistem ini statik sepenuhnya di bahagian hadapan, ia boleh dihoskan secara percuma atau kos rendah di mana-mana platform penyedia fail statik.

### Kaedah 1: Menghoskan di Vercel / Netlify / GitHub Pages
Ini adalah pilihan terpantas dan paling stabil.
1. Cipta akaun di **GitHub**, buat repositori baharu, dan tolak (push) kod dari direktori projek.
2. Daftar akaun di **Vercel** atau **Netlify**.
3. Sambungkan akaun GitHub anda dan pilih projek `_MT Sistem Com`.
4. Tetapkan konfigurasi berikut:
   * **Build Command**: Kosongkan (Tiada langkah kompilasi)
   * **Output Directory**: `.` (Direktori punca)
5. Klik **Deploy**. Sistem anda akan dihoskan di alamat HTTPS selamat.

### Kaedah 2: Pelayan Web Tradisional (Apache / Nginx / IIS)
Jika organisasi anda mempunyai pelayan dalaman:
1. Salin semua fail dalam direktori `c:\_MT Sistem Com` (kecuali fail ujian seperti `test_runner.html`) ke folder dokumen pelayan anda:
   * **Nginx**: `/var/www/html/`
   * **Apache**: `/var/www/html/` atau `public_html/`
   * **IIS**: `C:\inetpub\wwwroot\`
2. Pastikan pelayan Nginx dikonfigurasikan untuk melayani jenis fail `.js` sebagai `application/javascript` bagi memastikan modul berfungsi.
3. Contoh konfigurasi pelayan Nginx (`/etc/nginx/sites-available/default`):
   ```nginx
   server {
       listen 80;
       server_name komisen.mawar-teraju.com;
       root /var/www/html;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }

       # Caching static assets
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|xlsx)$ {
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }
   }
   ```

---

## 3. Senarai Semak Kesediaan Pelancaran (Deployment Readiness Checklist)

Penuhi kriteria di bawah sebelum memindahkan aplikasi ke persekitaran pengeluaran rasmi (production).

### 3.1 Migrasi Backend (Backend Migration)
- [ ] Menyediakan persekitaran run-time Node.js LTS pada pelayan.
- [ ] Membina rangka Express server untuk mengendalikan API REST.
- [ ] Memindahkan logik penghuraian fail Excel (`excel.js`) ke pelayan.

### 3.2 Integrasi PostgreSQL (PostgreSQL Integration)
- [ ] Menyediakan satu instance pangkalan data relasi PostgreSQL (Storan Awan / Managed DB).
- [ ] Menjana jadual pangkalan data bagi entiti `batches`, `commission_records`, `deduction_records`, dan `audit_logs`.
- [ ] Mengkonfigurasikan connection pooling untuk kestabilan trafik.

### 3.3 Pengerasan Autentikasi (Authentication Hardening)
- [ ] Membuang logik pengesahan sesi SHA-256 di browser klien.
- [ ] Melaksanakan sistem token sesi selamat berasaskan JWT (JSON Web Tokens) untuk panggilan API admin.
- [ ] Menjana hashing kata laluan pentadbir menggunakan bcrypt / argon2 di pelayan.

### 3.4 Persekitaran Pengeluaran (Production Environment)
- [ ] Memasang sijil SSL/TLS (HTTPS) melalui Let's Encrypt / Certbot.
- [ ] Mengkonfigurasikan fail pemboleh ubah persekitaran (`.env`) untuk data sensitif (`DATABASE_URL`, `JWT_SECRET`).
- [ ] Mematikan mod pembangunan (`NODE_ENV=production`).

### 3.5 Strategi Sandaran (Backup Strategy)
- [ ] Menyediakan skrip sandaran harian automatik (`pg_dump`) ke storan awan selamat.
- [ ] Menetapkan dasar penyimpanan sandaran (retention policy) minimum 30 hari.
- [ ] Menjalankan simulasi pemulihan data (recovery test) untuk mengesahkan skrip restore berfungsi.

### 3.6 Senarai Semak Keselamatan (Security Checklist)
- [ ] Menguatkuasakan HTTPS-only redirect.
- [ ] Melaksanakan middleware rate limiting untuk menyekat brute-force carian IC.
- [ ] Mengkonfigurasikan pengepala keselamatan CORS (Cross-Origin Resource Sharing) yang ketat.
- [ ] Memastikan semua input data ditapis untuk mengelakkan serangan SQL Injection.

### 3.7 Senarai Semak UAT (UAT Checklist)
- [ ] Melakukan ujian import batch dengan fail sampel berskala besar (1000+ baris).
- [ ] Membandingkan kiraan Jumlah Kasar, Jumlah Potongan, dan Jumlah Bersih pada sistem dengan fail asal (100% ketepatan).
- [ ] Menjalankan ujian keserasian pelayar web (Chrome, Firefox, Safari, Edge).
- [ ] Mendapatkan pengesahan visual (sign-off) bagi fail eksport PDF komisen dan potongan.

### 3.8 Senarai Semak Go-Live (Go-Live Checklist)
- [ ] Mengosongkan data ujian/simulasi dalam pangkalan data.
- [ ] Mengaktifkan log audit sistem pentadbir untuk pemantauan masa nyata.
- [ ] Menguji sambungan akhir domain DNS rasmi.
- [ ] Menjalankan smoke test (carian IC & muat naik batch) sejurus selepas deployment selesai.
