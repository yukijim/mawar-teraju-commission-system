# BUSINESS FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

This document defines the business flows, batch lifecycles, and search workflows for the Mawar Teraju Commission System.

---

## 1. Enterprise Batch Lifecycle (Admin Workflow)

The lifecycle of commission batch files is managed by the administrator. Statuses transition sequentially through six states to guarantee transactional integrity:

```text
  [ Upload Excel ]
         │
         ▼
    [ VALIDATING ] ──► (Validates workbook columns & schema)
         │
         ▼
    [ IMPORTING ]  ──► (Locks batch, performs chunked bulk inserts in transaction)
         │
         ▼
    [ IMPORTED ]   ──► (Unlocks batch, commits records as DRAFT)
         │
         ▼
    [ PUBLISHED ]  ──► (Activates batch, sets other concurrent batches to ARCHIVED)
         │
         ▼
    [ ARCHIVED ]   ──► (Deactivates search accessibility. Supported by rollback to previous versions)
```

### A. Batch Creation & Import (`DRAFT` / `VALIDATING` / `IMPORTING` / `IMPORTED`)
1. **DRAFT**: A batch metadata shell is initialized.
2. **VALIDATING**: Excel columns are read and validated.
3. **IMPORTING**: Checksum-based upload locking is applied. Overwrite and publish operations are blocked. Records are bulk inserted in transactional chunks.
4. **IMPORTED**: On successful transaction commit, status updates to `IMPORTED`. The lock is released. Records remain in a draft state, hidden from the public dispatcher carian.

### B. Activation & Version Control (`PUBLISHED`)
1. An admin reviews the imported summary and publishes the batch.
2. The batch status updates to `PUBLISHED` and `is_active` becomes `TRUE`.
3. If an active batch already exists for the same month/year period:
   - The version of the new batch is incremented (`version = previous_version + 1`).
   - The previous batch's ID is stored as `previous_batch_id`.
   - The previous batch is set to `is_active = FALSE` and status `ARCHIVED`.
   - **Only one published batch remains active** for search queries per period.

### C. Version Rollback (`ARCHIVED`)
1. If an admin discovers errors in a published batch (e.g. invalid excel row calculations):
   - The admin calls a rollback on the active batch ID.
   - The current active batch is marked as `is_active = FALSE` and `status = 'ARCHIVED'` (soft-deleted).
   - The batch pointed to by `previous_batch_id` is automatically reactivated (`is_active = TRUE`, `status = 'PUBLISHED'`).
   - The search portal instantly reflects the restored previous dataset.

---

## 2. Dispatcher Search Portal (Search Workflow)

Riders query commission information on the search portal:

```text
  [ Enter NRIC / IC ]
          │
          ▼
  [ Fetch Active Published Batches ]
          │
          ▼
  [ Merge Commission & Deduction Records by NRIC ]
          │
          ▼
  [ Render Financial Summaries & Dual PDF Reports ]
```

### A. Search Validation & Restrictions
1. A dispatcher enters their 12-digit Kad Pengenalan (IC) number.
2. The system formats and sanitizes the NRIC input.
3. **Enforced Limit**: Carian queries strictly extract records linked to **PUBLISHED** batches only (`status = 'PUBLISHED'`). Drafts, validating batches, and soft-deleted version history records are ignored.

### B. Relational Resolution
1. Using the dispatcher's NRIC, the system fetches records from:
   - `commission_records` where `batch_id` is published and active.
   - `deduction_records` where `batch_id` is published and active.
2. If records exist, the dispatcher portal displays the consolidated financial summary:
   - **Final Amount to Pay** (Net payment).
   - **Gross Commission** (Deliveries + Allowance additions).
   - **Gross Deductions** (COD + advance + HQ penalties).
3. The rider can download the Maroon-themed **Commission PDF** and Gold-themed **Deduction PDF** for their personal logs.
