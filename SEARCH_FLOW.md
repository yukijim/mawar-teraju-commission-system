# SEARCH FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

Dokumen ini memperincikan aliran teknikal proses carian Nombor Kad Pengenalan (IC) oleh Dispatcher pada portal carian dan proses penjanaan dokumen PDF rasmi.

---

## 1. Saluran Paip Carian & Penyatuan Data (Search & Join Pipeline)

```
[ Input No. IC ]
       │
       ▼
[ Sanitasi Input ] ──────────► (Buang sengkang & ruang kosong)
       │
       ▼
[ Ambil Batch Aktif ] ───────► (Cari batches: status='published' & active=1)
       │
       ▼
[ Query commission_records ] ─► (Cari guna indeks komposit batchId + ic)
       │
       ▼
[ Query deduction_records ] ──► (Cari guna indeks komposit batchId + ic)
       │
       ▼
[ Gabung Rekod (Join) ] ─────► (Padankan dan bina model DispatcherSummary)
       │
       ▼
[ Papar Hasil Carian UI ]
       │
       ├──────────────────────┐
       ▼                      ▼
[ Jana PDF Komisen ]   [ Jana PDF Butiran Potongan ]
```

---

## 2. Peringkat Penyatuan Data (Client-Side Join)

Pangkalan data IndexedDB tidak menyokong arahan `JOIN` SQL secara asal. Penyatuan data dilakukan dalam JavaScript menggunakan logik berikut:

1.  Apabila No. IC yang sah diserahkan (cth: `920605055111`), sistem memulakan transaksi `readonly` ke atas stores `commission_records` dan `deduction_records`.
2.  Sistem mencari rekod pada store `commission_records` menggunakan kunci komposit `[activeBatchId, cleanIc]`.
3.  Sistem mencari rekod pada store `deduction_records` menggunakan kunci komposit `[activeBatchId, cleanIc]`.
4.  Keputusan disatukan ke dalam objek JavaScript tunggal `DispatcherSummary`:
    ```javascript
    const DispatcherSummary = {
        ic_number: cleanIc,
        dispatcher_id: commissionRecord ? commissionRecord.dispatcher_id : deductionRecord.dispatcher_id,
        name: commissionRecord ? commissionRecord.name : deductionRecord.name,
        
        // Komisen & Tambahan
        parcel_qty: commissionRecord ? commissionRecord.parcel_qty : 0,
        exclude_extra_weight_yoyi: commissionRecord ? commissionRecord.exclude_extra_weight_yoyi : 0,
        commission_rate: commissionRecord ? commissionRecord.commission_rate : 0,
        extra_weight_commission: commissionRecord ? commissionRecord.extra_weight_commission : 0,
        total_commission: commissionRecord ? commissionRecord.total_commission : 0,
        addition_pickup_commission: commissionRecord ? commissionRecord.addition_pickup_commission : 0,
        addition_fuel_allowance: commissionRecord ? commissionRecord.addition_fuel_allowance : 0,
        addition_sorter: commissionRecord ? commissionRecord.addition_sorter : 0,
        nett_commission: commissionRecord ? commissionRecord.nett_commission : 0,
        final_amount_to_pay: commissionRecord ? commissionRecord.final_amount_to_pay : 0,
        
        // Potongan & Denda
        deduction_advance: deductionRecord ? deductionRecord.deduction_advance : 0,
        deduction_pending_cod: deductionRecord ? deductionRecord.deduction_pending_cod : 0,
        deduction_hq_penalty: deductionRecord ? deductionRecord.deduction_hq_penalty : 0,
        deduction_duitnow_penalty: deductionRecord ? deductionRecord.deduction_duitnow_penalty : 0,
        deduction_late_cod_penalty: deductionRecord ? deductionRecord.deduction_late_cod_penalty : 0,
        deduction_lost_individual: deductionRecord ? deductionRecord.deduction_lost_individual : 0,
        deduction_lost_parcel_hub: deductionRecord ? deductionRecord.deduction_lost_parcel_hub : 0,
        
        // Perincian Denda Khusus
        lost_pic_signed: deductionRecord ? deductionRecord.lost_pic_signed : 0,
        lost_rate: deductionRecord ? deductionRecord.lost_rate : 0,
        total_all_lost_shared: deductionRecord ? deductionRecord.total_all_lost_shared : 0,
        lost_parcel_pic_signed: deductionRecord ? deductionRecord.lost_parcel_pic_signed : 0,
        arbi_individual: deductionRecord ? deductionRecord.arbi_individual : 0,
        rcgen_penalty: deductionRecord ? deductionRecord.rcgen_penalty : 0,
        qc_penalty: deductionRecord ? deductionRecord.qc_penalty : 0,
        total_hq_penalty_detail: deductionRecord ? deductionRecord.total_hq_penalty_detail : 0
    };
    ```

---

## 3. Aliran Penjanaan Fail PDF (PDF Export Flow)

Dispatcher disediakan dengan dua pilihan muat turun PDF berasingan bagi menjaga kerahsiaan dan kejelasan struktur laporan.

### Fail A: Commission Report (Laporan Ringkasan Komisen)
*   **Format**: Tema korporat Mawar Teraju (Maroon `#8E1B32` dan Gold `#D4AF37`).
*   **Kandungan**:
    1.  Logo Rasmi Mawar Teraju.
    2.  Nama Batch & Tempoh Carian.
    3.  Maklumat Dispatcher (Nama, ID Dispatcher, No. IC).
    4.  Jadual Komisen:
        *   Jumlah Parcel & Net Parcel.
        *   Kadar Komisen RM1.11 & Jumlah Komisen Asas.
        *   Komisen Berat Tambahan.
        *   Allowance Tambahan (Pickup, Fuel, Sorter).
    5.  Jadual Ringkasan Potongan (Advance, COD, HQ Penalty, Lost).
    6.  **Final Amount to Pay** (Jumlah Bersih Akhir) dipaparkan secara besar dalam kad aksen Gold.

### Fail B: Details Deduction Report (Laporan Butiran Potongan & Denda)
*   **Format**: Tema Grid Minimalis dengan aksen warna kelabu/maroon untuk menyerlahkan item denda.
*   **Kandungan**:
    1.  Tajuk Rasmi: *"Penyata Perincian Denda & Potongan Dispatcher"*.
    2.  Maklumat Batch & Pengenalan Dispatcher.
    3.  Jadual Perperincian Denda HQ (QC, RCGEN, ARBI).
    4.  Jadual Perperincian Lost Parcel (Lost PIC Signed, Lost Rate, Lost Shared, Lost Individual).
    5.  Jumlah Keseluruhan Potongan Denda (`total_hq_penalty_detail` + `total_all_lost_shared` + `lost_parcel_pic_signed`).
    6.  Penafian Rasmi: *"Penyata ini dijana secara komputer bagi menerangkan denda yang dipindahkan dari sistem operasi ke penyata gaji."*
