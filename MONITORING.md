# DASHBOARD ANALYTICS, BACKUP & MONITORING SPECIFICATION

This document details the backend analytics summaries, system monitoring health engines, database backup flows, and rate limiting safeguards.

---

## 1. Dashboard Analytics Summary Engine

The analytics dashboard computes aggregated indicators over published batch records using optimized index lookup queries.

```text
                  [ GET /api/v1/dashboard/summary ]
                                  │
                                  ▼
                      [ Authentication Guard ]
                     (Restricts to ADMIN role)
                                  │
                                  ▼
                    [ Execute SQL Aggregations ]
             ├── Total payouts (Sum final_amount_to_pay)
             ├── Average commissions (Avg total_commission)
             ├── Total active dispatchers (Count unique ICs)
             └── Total penalties (Sum gross penalty columns)
                                  │
                                  ▼
                   [ Execute Comparative Trends ]
           (Lists historical monthly summaries up to 12 periods)
                                  │
                                  ▼
             [ Log Audit Event: VIEW_DASHBOARD & Response ]
```

---

## 2. Health Monitoring Diagnostic Metrics

The server executes diagnostic pings and gathers host performance metrics through `GET /api/v1/admin/monitor`:
- **OS telemetry**: Freemem, totalmem, uptime, CPU cores, platform.
- **Process telemetry**: Process uptime, CPU user/system usage, heap size used vs heap total.
- **Database health**: Validates PostgreSQL health and measures query ping latency in milliseconds.
- **Batch engine status**: Active locks and checksum map length.

All monitoring requests append to security audit logs under action `SYSTEM_MONITOR`.

---

## 3. Platform-Independent Custom Database Exporter

The endpoint `POST /api/v1/admin/backup` allows admins to trigger programmatic database backups.
1. The service reads the tables list sequentially: `users`, `batches`, `dispatcher_mappings`, `commission_records`, `deduction_records`, `search_history`, `audit_logs`.
2. Resolves and normalizes row values to compile clean `INSERT INTO ...` SQL lines.
3. Packages the buffer stream to download as a `.sql` attachment.
4. Records database backup actions under security audit logs as `DATABASE_BACKUP`.
