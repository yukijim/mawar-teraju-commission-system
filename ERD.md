# ENTITY RELATIONSHIP DIAGRAM (Sistem Komisen Mawar Teraju)

Dokumen ini memaparkan hubungan data bagi skema database **DATABASE_V2** menggunakan gambarajah Mermaid.

---

## 1. Gambarajah ERD (Mermaid ERD)

```mermaid
erDiagram
    BATCHES {
        number id PK "Auto Increment"
        string name "cth: Jun 2026"
        number month "Bulan (1-12)"
        number year "Tahun (cth: 2026)"
        string status "draft | published | archived"
        number active "1 = Aktif, 0 = Tidak Aktif"
        string commission_file "Nama fail excel komisen"
        string deduction_file "Nama fail excel potongan"
        number created_time "Cap masa penciptaan"
        number published_time "Cap masa penerbitan"
    }

    DISPATCHER_MAPPINGS {
        string dispatcher_id PK "cth: NSN3052004"
        string ic_number "Nombor IC 12-digit, unik"
        string name "Nama penuh dispatcher"
        number last_updated "Cap masa dikemaskini"
    }

    COMMISSION_RECORDS {
        number id PK "Auto Increment"
        number batchId FK "Rujukan ke BATCHES.id"
        string dispatcher_id FK "Rujukan ke DISPATCHER_MAPPINGS.dispatcher_id"
        string ic_number "No. IC (diambil dari mapping)"
        string name "Nama penuh dispatcher"
        number parcel_qty "Kuantiti parcel"
        number net_parcel "Net parcel"
        number exclude_extra_weight_yoyi "Parcel ditolak YOYI"
        number commission_rate "Komisen RM1.11 per parcel"
        number diff_rate_new_joiner "Pelarasan joiner baru"
        number count_pickup "Kiraan pickup"
        number extra_weight_commission "Komisen berat tambahan"
        number total_commission "Jumlah kasar komisen"
        number addition_pickup_commission "Komisen pickup tambahan"
        number addition_fuel_allowance "Elaun minyak tambahan"
        number addition_sorter "Elaun sorter tambahan"
        number nett_commission "Komisen bersih"
        number final_amount_to_pay "Bayaran bersih akhir (dibundar)"
        string system_reg "No rujukan sistem"
        string status_payment "Status bayaran"
        string date_payment "Tarikh bayaran"
        string remark "Catatan admin"
    }

    DEDUCTION_RECORDS {
        number id PK "Auto Increment"
        number batchId FK "Rujukan ke BATCHES.id"
        string dispatcher_id FK "Rujukan ke DISPATCHER_MAPPINGS.dispatcher_id"
        string ic_number "No. IC (diambil dari mapping)"
        string name "Nama penuh dispatcher"
        number deduction_others "Potongan advance / lain-lain"
        number deduction_pending_cod "Potongan pending COD"
        number deduction_duitnow_penalty "Potongan denda DuitNow"
        number deduction_late_cod_penalty "Potongan denda COD lewat"
        number lost_pic_signed "Denda lost parcel PIC signed"
        number lost_rate "Denda lost rate"
        number total_all_lost_shared "Denda lost parcel hub"
        number lost_parcel_pic_signed "Denda lost parcel individu"
        number arbi_individual "Denda ARBI"
        number rcgen_penalty "Denda RCGEN"
        number qc_penalty "Denda QC"
        number total_hq_penalty_detail "Jumlah denda HQ"
    }

    PENALTY_RECORDS {
        uuid id PK "gen_random_uuid()"
        string delivery_dispatcher_id FK "Rujukan ke DISPATCHER_MAPPINGS.dispatcher_id"
        string delivery_dispatcher_name "Nama dispatcher"
        string awb "Nombor AWB, unik"
        number fake_return "Potongan denda fake return"
        number fake_problematic "Potongan denda fake problematic"
        number fraud_delivery "Potongan denda fraud delivery"
        number arbitration "Potongan denda arbitration"
        number individual_lost "Potongan denda lost individual"
        number logic "Potongan denda logic"
    }

    BATCHES ||--o{ COMMISSION_RECORDS : "contains"
    BATCHES ||--o{ DEDUCTION_RECORDS : "contains"
    DISPATCHER_MAPPINGS ||--o{ COMMISSION_RECORDS : "maps"
    DISPATCHER_MAPPINGS ||--o{ DEDUCTION_RECORDS : "maps"
    DISPATCHER_MAPPINGS ||--o{ PENALTY_RECORDS : "maps"
```

---

## 2. Hubungan Data & Peraturan Kunci Asing (Constraints)

1.  **Kunci Utama (Primary Key - PK)**:
    *   Setiap object store mempunyai kunci utama yang unik untuk rujukan langsung (O(1) lookup).
2.  **Kunci Asing (Foreign Key - FK)**:
    *   Store `commission_records` dan `deduction_records` merujuk kepada `batches.id` melalui medan `batchId`.
    *   Kedua-dua store rekod tersebut juga merujuk kepada `dispatcher_mappings.dispatcher_id` melalui medan `dispatcher_id`.
3.  **Kesan Pemadaman (Cascade Delete Rule)**:
    *   Apabila suatu entri `batches` dipadamkan, transaksi pangkalan data akan memicu pemadaman melata secara automatik bagi semua rekod yang berkaitan pada `commission_records` dan `deduction_records` yang mempunyai `batchId` yang sama. Ini menghalang kewujudan data tergantung (orphaned data).
4.  **Kunci Carian Dispatcher**:
    *   Indeks komposit `batch_ic` pada `commission_records` dan `deduction_records` menggabungkan `batchId` dan `ic_number`. Ini membolehkan carian pantas terus dilakukan tanpa perlu melakukan silangan jadual `dispatcher_mappings` yang perlahan pada runtime carian.
