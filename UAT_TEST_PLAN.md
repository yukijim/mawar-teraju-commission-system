# UAT TEST PLAN - REEKOD SEMAK v1.0.0-rc1

Pelan Ujian Penerimaan Pengguna (User Acceptance Testing) bagi mengesahkan kestabilan, sekuriti, dan integriti fungsian platform semakan komisen REEKOD Semak.

---

## 1. Maklumat Staging & Persekitaran
- **Alamat Portal Staging**: `https://semak.reekod.com`
- **Pangkalan Data**: PostgreSQL 15 (Ubuntu VPS)
- **Pengurus Proses**: PM2 (Cluster Mode)
- **Pelayan Web**: Nginx Reverse Proxy (SSL Terminated)
- **DNS/SSL Provider**: Cloudflare Proxy (Full Strict)

---

## 2. Kriteria Penerimaan (Acceptance Criteria)
1. **Feature Freeze**: Tiada perubahan kod fungsian baharu dibenarkan semasa UAT berlangsung.
2. **Integriti Data**: Penuh (Tiada percanggahan nilai antara hamparan Excel asal dengan data database).
3. **Kestabilan PDF**: Dokumen PDF terbina tanpa korupsi sintaks, menyokong Unicode nama Melayu, nombor negatif, dan pembahagian halaman (pagination).
4. **Sekatan RBAC**: Dispatcher (`DISPATCH` role) dilarang sama sekali melihat atau memuat turun data milik rider lain.
5. **Kebolehpulihan**: Proses restore backup pangkalan data dari fail `pg_dump` (.sql.gz) diuji lulus 100%.

---

## 3. Senarai Senario Ujian (UAT Test Cases)

| ID Ujian | Modul / Senario | Langkah-Langkah Ujian | Hasil Jangkaan |
| :--- | :--- | :--- | :--- |
| **TC-01** | Admin Authentication | Log masuk ke portal staging menggunakan kredensial Admin. Uji salah kata laluan, had kadar (rate limits), dan token rotation. | Lulus pengesahan, token JWT disimpan di HTTP Only cookie, log audit `SUCCESS_LOGIN` direkod. |
| **TC-02** | Excel Upload & Validation | Muat naik fail Commission & Deduction Excel. Uji penduaan checksum SHA-256, format silap, dan pengesahan lajur. | Batch draf baru dicipta, data diimport ke jadual pembantu, checksum dikunci bagi menghalang double upload. |
| **TC-03** | Batch Publishing | Terbitkan batch bertaraf `DRAFT` menjadi `PUBLISHED` melalui panel admin. | Status batch bertukar ke `PUBLISHED`, batch sedia diakses untuk carian dispatch. |
| **TC-04** | Dispatcher Search | Log masuk peranan `DISPATCH`, cari NRIC dengan sempang (`-`) atau ruang kosong. | Sistem menormalisasikan IC, memapangkan data terperinci komisen/denda batch `PUBLISHED` yang sah sahaja. |
| **TC-05** | PDF Report Engine | Klik butang muat turun Laporan Komisen (Maroon) dan Perincian Denda (Gold). | Fail PDF dimuat turun dengan format A4, logo vector, Unicode nama penuh, nombor negatif dipaparkan (`RM -X.XX`), dan halaman terbahagi kemas. |
| **TC-06** | Backup & Restores | Jalankan skrip `backup.sh`. Simpan fail hasil `.sql.gz` ke luar VPS, kemudian lakukan restore ke DB staging ujian. | Fail backup terhasil, proses pemulihan database mengembalikan semua jadual secara lengkap tanpa ralat. |
| **TC-07** | Diagnostics Monitor | Panggil endpoint `GET /api/v1/admin/monitor` menggunakan peranan ADMIN. | Memaparkan status kesihatan `OK`/`WARNING`, disk usage, memory heap, dan latency pangkalan data. |
