# Panduan Pemasangan Manual Patch (Manual Deployment Guide)

Panduan ini menyediakan langkah demi langkah untuk memigrasikan struktur pangkalan data pengeluaran (production database) dan mengaplikasikan patch pembetulan kod untuk perkhidmatan upload dan `apiFetch`.

---

## Senarai Kandungan Folder Patch:
1. `007_align_deduction_records.sql` - Skrip migrasi SQL untuk menyelaraskan skema jadual `deduction_records` dan menggugurkan kekangan unik pada `ic_number` untuk jadual `dispatcher_mappings`.
2. `upload_repository.patch` - Fail patch perbezaan kod (git diff) untuk `uploadRepository.js`.
3. `ui_api_fetch.patch` - Fail patch perbezaan kod (git diff) untuk `ui.js`.

---

## Langkah 1: Pengesahan & Migrasi Pangkalan Data Pengeluaran

Sebelum kod baru dijalankan, pastikan skema jadual diselaraskan.

1. Log masuk ke VPS pengeluaran anda.
2. Akses CLI PostgreSQL dan semak struktur semasa jadual `deduction_records`:
   ```bash
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -c "\d deduction_records"
   ```
3. Jalankan skrip migrasi SQL `007_align_deduction_records.sql`:
   ```bash
   psql -h localhost -U mawar_admin -d mawar_teraju_commission -f 007_align_deduction_records.sql
   ```

---

## Langkah 2: Aplikasikan Patch Kod pada Repositori VPS

Jalankan arahan `git apply` di dalam folder root projek anda pada VPS untuk mengaplikasikan patch perubahan kod.

### A. Patch: uploadRepository.js (Membetulkan Mismatch Lajur / Placeholder)
Langkah ini membetulkan ralat di mana `bulkInsertDeductionRecords` memasukkan 19 parameter tetapi menggunakan 21 placeholders di dalam query.
```bash
git apply upload_repository.patch
```

### B. Patch: ui.js (Carian apiFetch Isomorphic/Safe Local Testing)
Langkah ini menyelaraskan `apiFetch` agar hanya menghantar carian ke backend port `5000` semasa dalam persekitaran local testing sahaja (iaitu apabila dibuka dari `localhost:9999` atau `127.0.0.1:9999`), manakala pada pelayan pengeluaran ia akan menggunakan relative path standard.
```bash
git apply ui_api_fetch.patch
```

---

## Langkah 3: Bina Semula (Rebuild) & Mulakan Semula (Restart) Servis

Selepas semua perubahan kod diaplikasikan:

1. Pergi ke direktori backend:
   ```bash
   cd /opt/mawar-teraju/backend
   ```
2. Mulakan semula kluster backend PM2 untuk memuatkan perubahan kod yang baru:
   ```bash
   pm2 reload all --update-env
   ```
3. Muat semula reverse proxy Nginx (jika perlu):
   ```bash
   sudo systemctl reload nginx
   ```
