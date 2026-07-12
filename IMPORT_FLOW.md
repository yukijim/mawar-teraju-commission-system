# IMPORT FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

This document details the backend processing pipeline for Excel files from client upload to structured records in the PostgreSQL database.

---

## 1. Backend Processing Pipeline

The Mawar Teraju Excel Upload Engine parses raw spreadsheet files, normalizes columns dynamically, validates schemas, verifies NRIC profiles, and executes transactional bulk inserts.

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
            │            ├── Yes -> Stage transaction for Overwrite
            │            └── No  -> Abort (409 Conflict: UPLOAD_DUPLICATE_FILE)
            └── Not Found -> Proceed to parsing
                              │
                              ▼
                 [ Parse Workbook (SheetJS) ]
                     (Option raw: false)
                              │
                              ▼
             [ Header Dynamic Mapping & Validation ]
           (Requires: ID, IC, Name, Numeric cols)
                              │
                              ▼
                [ Extract & Resolve Mappings ]
          (Build Master Mapping: ID -> NRIC / IC)
                              │
                              ▼
                  [ PostgreSQL Transaction ]
           ├── BEGIN
           ├── If Overwrite: Delete existing Batch & Records
           ├── Create New Batch (UUID)
           ├── Bulk Insert Mappings / Commissions / Deductions
           ├── COMMIT (Audit Success: UPLOAD_SUCCESS)
           └── ROLLBACK (On failure -> Audit: UPLOAD_FAILED)
```

---

## 2. Processing Stages

### Stage A: Checksum Deduplication & Overwrite
1. The file is uploaded into memory as a buffer.
2. The server computes the **SHA-256 cryptographic checksum** of the buffer.
3. It checks if the checksum already exists in the `batches` table:
   - If a duplicate is found, and `overwrite` parameter is not `true`, the upload is rejected.
   - If `overwrite` is `true`, but the user role is not `ADMIN`, it is rejected.
   - If `overwrite` is `true` and the user is an `ADMIN`, the engine registers an `UPLOAD_OVERWRITE` event and schedules the deletion of the existing batch inside the transaction block.

### Stage B: Passive Cell Value Extraction
1. The workbook is read using SheetJS with the configuration `{ raw: false }`.
2. This forces the parser to read only the `.w` formatted text values (the computed cell values calculated internally by Excel) rather than raw variables.
3. Formulas are never calculated in JavaScript, ensuring Excel remains the absolute **Single Source of Truth**.

### Stage C: Dynamic Header Mapping & Column Validation
1. The parser normalizes headers (stripping carriage returns, converting to lowercase, and collapsing multiple spaces to a single space).
2. It matches columns against mapping rules (e.g. `Delivery Dispatcher ID`, `COUNT DIGIT`, `RM1.11/Parcel Commission`, `Total Commission`).
3. If required columns are missing, the import fails with a `400 Bad Request` (`UPLOAD_INVALID_TEMPLATE`).

### Stage D: Relational Mapping (Master Mapping)
1. During a **Commission Excel** upload, the system reads columns `Delivery Dispatcher ID` and `COUNT DIGIT` (IC/NRIC).
2. It strips hyphens and spaces from the IC column, creating a normalized 12-digit string.
3. It writes or updates these dispatcher-to-IC relationships in the `dispatcher_mappings` table.
4. During a **Deduction Excel** upload, raw records do not contain the IC number directly. The service queries the `dispatcher_mappings` table to resolve the IC number for each dispatcher ID. If a dispatcher's mapping does not exist, the record is skipped.

### Stage E: PostgreSQL Transaction & Cascade Cleanups
1. A transaction client is retrieved from the connection pool.
2. The transaction is initiated: `BEGIN`.
3. If overwriting, the existing duplicate batch is deleted: cascading rules automatically delete all commission or deduction records associated with that batch.
4. A new batch metadata record is inserted with a UUID primary key.
5. Records are bulk inserted in batches (multi-row INSERT query) to optimize speed and query counts.
6. If all records insert successfully, the transaction is committed: `COMMIT`, and the audit trail logs `UPLOAD_SUCCESS`.
7. If any database constraint is violated (e.g. duplicate IC, null values, key mismatch), the transaction rollbacks completely: `ROLLBACK`, restoring database state to its original form, and the audit log records `UPLOAD_FAILED`.
