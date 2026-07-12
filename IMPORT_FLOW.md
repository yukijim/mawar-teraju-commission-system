# IMPORT FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

This document details the backend processing pipeline for Excel files from client upload to structured records in the PostgreSQL database, incorporating Enterprise Batch Management workflows.

---

## 1. Enterprise Processing Pipeline

The Mawar Teraju Excel Upload Engine parses spreadsheets, normalizes columns dynamically, validates schemas, verifies NRIC profiles, and executes transactional bulk inserts. It handles locking, progress reporting, and version control.

```text
       [ POST /api/v1/upload/commission or /deduction ]
                              │
                              ▼
                      [ Read File Buffer ]
                              │
                              ▼
                [ Calculate SHA-256 Checksum ]
                              │
                              ▼
            [ Check duplicates in batches table ]
            ├── Found -> Overwrite flag & ADMIN check ?
            │            ├── Yes -> Verify no active lock. Delete old batch in transaction.
            │            └── No  -> Abort (409 Conflict: UPLOAD_DUPLICATE_FILE)
            └── Not Found -> Proceed to lock
                              │
                              ▼
              [ Check in-memory activeLocks ]
           ├── Locked -> Abort (409 Conflict: UPLOAD_BATCH_LOCKED)
           └── Free   -> Add checksum to activeLocks. Set status VALIDATING (10%).
                              │
                              ▼
                 [ Parse Workbook (SheetJS) ]
                     (Option raw: false)
                              │
                              ▼
             [ Header Dynamic Mapping & Validation ]
                              │
                              ▼
                 [ Set status IMPORTING (30%) ]
                              │
                              ▼
                  [ PostgreSQL Transaction ]
           ├── BEGIN
           ├── Determine new version (max_version + 1)
           ├── Link previous_batch_id (latest active)
           ├── Create New Batch in DRAFT status
           ├── Bulk insert records in chunks of 500
           │    └── Update progress percentage (30% to 90%)
           ├── COMMIT (Status set to IMPORTED, progress 100%)
           └── ROLLBACK (On failure -> Status FAILED)
                              │
                              ▼
                   [ Release activeLocks ]
```

---

## 2. Processing & Management Stages

### Stage A: Checksum Deduplication & Upload Locking
1. The file is uploaded into memory as a buffer.
2. The server computes the **SHA-256 cryptographic checksum** of the buffer.
3. It checks the in-memory `activeLocks` Set: if the file checksum is locked, the request is aborted. Otherwise, it is added to `activeLocks`.
4. It checks if the checksum already exists in the `batches` table:
   - If a duplicate is found, and `overwrite` parameter is not `true`, the upload is rejected.
   - If `overwrite` is `true`, but the user role is not `ADMIN`, it is rejected.
   - If `overwrite` is `true` and the duplicate batch is currently importing/validating, it is rejected to prevent race conditions.

### Stage B: Passive Cell Value Extraction
1. The workbook is read using SheetJS with the configuration `{ raw: false }`.
2. This forces the parser to read only the `.w` formatted text values (the computed cell values calculated internally by Excel) rather than raw variables.
3. Formulas are never calculated in JavaScript, ensuring Excel remains the absolute **Single Source of Truth**.

### Stage C: Dynamic Header Mapping & Column Validation
1. The parser normalizes headers (stripping carriage returns, converting to lowercase, and collapsing multiple spaces to a single space).
2. It matches columns against mapping rules (e.g. `Delivery Dispatcher ID`, `COUNT DIGIT`, `RM1.11/Parcel Commission`, `Total Commission`).
3. If required columns are missing, the import fails, releasing the checksum lock.

### Stage D: Relational Mapping (Master Mapping)
1. During a **Commission Excel** upload, the system reads columns `Delivery Dispatcher ID` and `COUNT DIGIT` (IC/NRIC).
2. It strips hyphens and spaces from the IC column, creating a normalized 12-digit string.
3. It writes or updates these dispatcher-to-IC relationships in the `dispatcher_mappings` table.
4. During a **Deduction Excel** upload, raw records do not contain the IC number directly. The service queries the `dispatcher_mappings` table to resolve the IC number for each dispatcher ID. If a dispatcher's mapping does not exist, the record is skipped.
5. **Duplicate Record Detection**: The system hashes the unique combination of `Batch ID` + `Dispatcher ID` + `IC Number` for each record. If a duplicate is detected in the spreadsheet, it is skipped and logged under the duplicate count in the upload summary.

### Stage E: PostgreSQL Transaction & Cascade Cleanups
1. A transaction client is retrieved from the connection pool.
2. The transaction is initiated: `BEGIN`.
3. If overwriting, the existing duplicate batch is deleted: cascading rules automatically delete all commission or deduction records associated with that batch.
4. The system queries the database for the max version and latest active published batch for the period.
5. A new batch metadata record is inserted with the calculated version (`latest_version + 1`) and previous batch link (`previous_batch_id`).
6. Records are bulk inserted in chunks of 500. After each chunk is written, the progress tracker is updated (`progress` maps from 30% to 90%).
7. If all records insert successfully, the transaction is committed: `COMMIT`, the batch status becomes `IMPORTED` (progress 100%), and the audit log records `UPLOAD_SUCCESS`.
8. If any database constraint is violated, the transaction rolls back: `ROLLBACK`, the batch status becomes `FAILED`, and the checksum lock is released.

---

## 3. Enterprise Batch Management Actions

### GET /api/v1/upload/progress/:batchId
Returns active progress data from the in-memory map. If the batch has completed processing, it queries the database and returns a 100% complete `IMPORTED` status.

### POST /api/v1/upload/publish/:batchId
Allows an admin to publish a successfully imported batch.
1. Checks that the batch is not locked.
2. Inside a database transaction:
   - Deactivates all other published batches for that period (`is_active = FALSE`, `status = 'ARCHIVED'`).
   - Activates the current batch (`is_active = TRUE`, `status = 'PUBLISHED'`, `published_at = CURRENT_TIMESTAMP`).
   - Commits transaction and logs `PUBLISH_BATCH`.

### POST /api/v1/upload/rollback/:batchId
Allows an admin to deactivate a published batch and reactivate its previous version.
1. Checks that the batch is not locked.
2. Inside a database transaction:
   - Deactivates the current batch (`is_active = FALSE`, `status = 'ARCHIVED'`).
   - Reactivates the linked `previous_batch_id` batch (`is_active = TRUE`, `status = 'PUBLISHED'`).
   - Commits transaction and logs `ROLLBACK_BATCH`.
