# SEARCH FLOW SPECIFICATION (Sistem Komisen Mawar Teraju)

This document defines the backend processing flow, pagination strategy, security layers, logging schemas, and architecture for the Enterprise Commission Search Engine.

---

## 1. Search Query Pipeline

The search engine processes incoming queries through security filters and constructs parameterized prepared queries to retrieve matching commissions and deductions.

```text
            [ GET /api/v1/search?ic_number=... ]
                             │
                             ▼
                 [ Authentication Guard ]
            (Checks JWT status, user role & claims)
                             │
                             ▼
                 [ Security Role Filtering ]
           ├── User is DISPATCH:
           │    ├── Lock query NRIC to logged-in user's mapped NRIC
           │    └── Force filter: status = 'PUBLISHED' AND is_active = TRUE
           └── User is ADMIN:
                └── Allow arbitrary NRIC, Dispatcher ID, Batch ID, and status queries
                             │
                             ▼
                [ Query Parameter Extraction ]
           (Month, Year, Version, Sort, Order, Page, Limit)
                             │
                             ▼
              [ Safe Sorting Column Validation ]
       (Ensures sort is within whitelisted database columns)
                             │
                             ▼
             [ Prepared Statement Execution ]
         (Using PostgreSQL parameterized bindings)
                             │
                             ▼
              [ Log Audit & Latency Metrics ]
           ├── Save trace inside search_history table
           └── Log security query event in audit_logs
                             │
                             ▼
           [ Payload Formatting & API Response ]
```

---

## 2. Security & Access Rules

### A. Role Constraints
- **DISPATCH User**:
  - A dispatcher can *only* search their own financial records.
  - The service resolves the dispatcher's username to their registered `ic_number` in `dispatcher_mappings` and overrides any requested search parameter.
  - Dispatchers can *only* access records belonging to **active published batches** (`status = 'PUBLISHED' AND is_active = TRUE`). Drafts, validating batches, and archived versions are completely hidden.
- **ADMIN User**:
  - Administrators can search records across all riders, batch periods, versions, and states.

### B. Audit Compliance & Metrics
For every search executed, a record is created in the `search_history` table:
- **`user_id`**: The UUID of the authenticated searcher.
- **`ic_number`**: The NRIC queried (masked or normalized).
- **`dispatcher_id`**: The dispatcher ID queried.
- **`ip_address`**: The client's IP.
- **`duration`**: The exact database lookup latency in milliseconds.
- **`created_at`**: Timestamp.

Additionally, an action entry (`COMMISSION_SEARCH`) is appended to the central `audit_logs` table.

---

## 3. Query Performance & SQL Security

### A. Prepared Statements
All query filters (NRIC, dispatcher ID, batch UUID, month, year, version, offset, limit) are passed using parameterized bindings (e.g. `$1`, `$2`). This isolates inputs, preventing **SQL Injection** attacks, and allows PostgreSQL to cache query plans.

### B. Safe Sorting
To prevent SQL injection via `ORDER BY` query inputs, the repository checks the `sort` parameter against a hard whitelisted column map:
```javascript
ALLOWED_SORT_COLUMNS = {
  name: 'c.name',
  ic_number: 'c.ic_number',
  dispatcher_id: 'c.dispatcher_id',
  final_amount_to_pay: 'c.final_amount_to_pay',
  nett_commission: 'c.nett_commission',
  parcel_qty: 'c.parcel_qty',
  month: 'b.month',
  year: 'b.year',
  version: 'b.version'
};
```
If a parameter is not in the whitelist, the engine falls back to `c.name`.

### C. Indexes
Queries are optimized to scan composite indexes and foreign key references:
- Primary/Foreign keys use UUID binary formats.
- An index exists on `commission_records(ic_number)` and `commission_records(batch_id)`.
- Composite index `uq_commission_batch_ic (batch_id, ic_number)` accelerates joined lookups.

---

## 4. Export Architecture Hooks

To prepare the platform for PDF and Excel exports, the search service exposes two architectural hooks:

### A. PDF Export Hook
- Generates a structure containing the dispatcher record data, validation metrics, and theme formatting (e.g., `Gold` for deductions, `Maroon` for commissions).
- Endpoint: `GET /api/v1/search/export/pdf?recordId=...`

### B. Excel Export Hook
- Prepares cell matrix structures from query results to stream directly into sheet layout cells.
- Endpoint: `GET /api/v1/search/export/excel?batchId=...`
