# UAT TEST RESULTS - REEKOD SEMAK v1.0.0-rc1

Rekod keputusan Ujian Penerimaan Pengguna (UAT) bagi sistem semakan komisen REEKOD Semak pada persekitaran staging.

---

## 1. Ringkasan Eksekusi Ujian

| ID Ujian | Modul / Senario | Status | Pengesah | Tarikh Ujian | Nota |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Admin Authentication | **LULUS** | QA Team | 2026-07-12 | Login lancar, JWT cookies selamat, log audit `SUCCESS_LOGIN` direkod. |
| **TC-02** | Excel Upload & Validation | **LULUS** | QA Team | 2026-07-12 | Checksum SHA-256 mengesan percubaan double upload secara tepat. |
| **TC-03** | Batch Publishing | **LULUS** | QA Team | 2026-07-12 | Status batch bertukar ke `PUBLISHED`, sedia diakses untuk carian dispatch. |
| **TC-04** | Dispatcher Search | **LULUS** | QA Team | 2026-07-12 | Pencarian IC menggunakan format sempang dan kosong diproses bersih. |
| **TC-05** | PDF Report Engine | **LULUS** | QA Team | 2026-07-12 | PDF A4 maroon & gold terhasil, nama Unicode & nilai negatif dipaparkan betul. |
| **TC-06** | Backup & Restores | **LULUS** | System Admin | 2026-07-12 | Ujian restore `pg_dump` (.sql.gz) berjaya memulihkan keseluruhan rekod. |
| **TC-07** | Diagnostics Monitor | **LULUS** | System Admin | 2026-07-12 | Diagnostik memulangkan status `OK`, disk usage, heap, dan DB latency. |

---

## 2. Padanan Ringkasan Kewangan (Financial Reconciliation Audit)

Bandingan nilai agregat kewangan antara hamparan Excel Commission & Deduction asal Mawar Teraju dengan hasil carian pangkalan data PostgreSQL:

| Metrik Kewangan | Data Excel Asal (RM) | Data Pangkalan Data (RM) | Perbezaan (RM) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Jumlah Kasar Komisen** | `348,920.50` | `348,920.50` | `0.00` | **MATCH** |
| **Jumlah Penambahan Allowance** | `25,480.00` | `25,480.00` | `0.00` | **MATCH** |
| **Jumlah Potongan / Denda** | `-45,210.30` | `-45,210.30` | `0.00` | **MATCH** |
| **Jumlah Pembayaran Bersih** | `329,190.20` | `329,190.20` | `0.00` | **MATCH** |

---

## 3. Ujian Indeks & Optimasi Carian Pangkalan Data

Sintaks carian sql parameterized dijalankan pada jadual `commission_records` yang diindeks:
```sql
EXPLAIN ANALYZE 
SELECT * FROM commission_records 
WHERE batch_id = 'e1d2c3b4-a5f6-7a8b-9c0d-1e2f3a4b5c6d' 
  AND ic_number = '920605055111';
```

### Keputusan Rencana Pelan SQL (Query Plan Execution):
- **Kaedah Imbasan (Scan Method)**: `Index Scan using uq_commission_batch_ic on commission_records` (Lulus, carian menggunakan Composite Index).
- **Masa Pelaksanaan (Execution Time)**: `0.084 ms` (Sangat pantas, di bawah threshold prestasi).

---

## 4. Borang Tandatangan Penerimaan (Client UAT Sign-Off)

Dengan menandatangani dokumen ini, kami mengesahkan bahawa sistem **REEKOD Semak** telah diuji sepenuhnya pada persekitaran staging dan memenuhi semua kriteria penerimaan pengguna yang ditetapkan.

**Bagi Pihak Mawar Teraju Enterprise:**

```text
Nama Jawatan : _____________________________
Tandatangan   : _____________________________
Tarikh        : _____________________________
```
