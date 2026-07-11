# REST API Contract - Commission Lookup System

Dokumen ini mentakrifkan spesifikasi komunikasi HTTP (REST API endpoints) antara Klien (Front-end) dan Pelayan (Express Backend).

---

## 1. Standard Rangka Kerja & Pengepala (Headers)

Semua permohonan API mengembalikan data berformat **JSON**. Pengepala (Headers) standard:

*   `Content-Type: application/json`
*   `Authorization: Bearer <JWT_TOKEN>` (Hanya untuk laluan admin yang dilindungi)

---

## 2. Pengekodan Ralat (Error Response Schema)

Jika berlaku ralat, pelayan akan mengembalikan skema JSON standard berikut berserta HTTP Status Code yang sesuai:

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "error": "Nombor IC tidak sah atau tidak lengkap.",
  "details": null
}
```

### Kod Ralat Standard (Error Codes)
*   `BAD_REQUEST` (400): Parameter tidak lengkap, parsing Excel gagal, lajur tidak padan.
*   `UNAUTHORIZED` (401): Tiada token, token tamat tempoh, token tidak sah.
*   `FORBIDDEN` (403): Kebenaran ditolak (RBAC menyekat akses bukan Admin).
*   `NOT_FOUND` (404): Rekod batch atau nombor IC tidak ditemui.
*   `CONFLICT` (409): Nama batch bertindih dengan batch sedia ada.
*   `INTERNAL_ERROR` (500): Kegagalan database, transaksi terbatal (*rollback*).

---

## 3. Endpoints Autentikasi (Authentication)

### A. Log Masuk Admin (`POST /api/auth/login`)
*   **Akses**: Awam (Public)
*   **Request Body**:
    ```json
    {
      "username": "admin",
      "password": "kata_laluan_anda"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "username": "admin",
        "role": "admin"
      }
    }
    ```
*   **Response (401 Unauthorized)**: Kata laluan atau nama pengguna salah.

### B. Tukar Kata Laluan Admin (`POST /api/auth/change-password`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Request Body**:
    ```json
    {
      "oldPassword": "kata_laluan_lama",
      "newPassword": "kata_laluan_baru"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Kata laluan berjaya dikemas kini."
    }
    ```

---

## 4. Endpoints Pengurusan Batch (Admin Batch Management)

### A. Ambil Senarai Batch (`GET /api/batches`)
*   **Akses**: Dinamik (Admin: lihat semua | Rider: lihat status `published` sahaja)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "batches": [
        {
          "id": "b1b7021b-cfc1-4770-b74a-7186178c78c3",
          "batch_name": "COMMISSION BATCH JUN 2026",
          "month": 6,
          "year": 2026,
          "status": "published",
          "commission_file_name": "commission_jun.xlsx",
          "deduction_file_name": "deduction_jun.xlsx",
          "created_at": "2026-07-11T12:00:00Z"
        }
      ]
    }
    ```

### B. Muat Naik & Bina Batch Baru (`POST /api/batches`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Content-Type**: `multipart/form-data`
*   **Request Form Fields**:
    *   `batch_name` (Text)
    *   `month` (Number)
    *   `year` (Number)
    *   `commissionFile` (Binary File)
    *   `deductionFile` (Binary File)
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "batch_id": "b1b7021b-cfc1-4770-b74a-7186178c78c3",
      "message": "Batch berjaya dibina dan data fail Excel diimport secara pasif."
    }
    ```
*   **Response (400 Bad Request - Ralat Skema Lajur)**:
    ```json
    {
      "success": false,
      "code": "BAD_REQUEST",
      "error": "Lajur fail Excel tidak sah.",
      "details": {
        "file": "commissionFile",
        "missing_columns": ["Delivery Dispatcher ID", "Nett Commission"]
      }
    }
    ```

### C. Kemas Kini Status Batch (`POST /api/batches/:id/status`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Request Body**:
    ```json
    {
      "status": "published" // draft | published | archived
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Status batch berjaya dikemaskini."
    }
    ```

### D. Padam / Rollback Batch (`DELETE /api/batches/:id`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Batch dan semua rekod komisen serta potongan berkaitan berjaya dipadam secara cascading."
    }
    ```

---

## 5. Endpoints Carian Dispatcher (Public Lookup)

### A. Carian Mengikut Kad Pengenalan (`GET /api/dispatch/search`)
*   **Akses**: Awam (Public)
*   **Query Parameters**:
    *   `ic_number` (String, format `XXXXXX-XX-XXXX` atau `XXXXXXXXXXXX`)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "rider": {
        "name": "MOHD RAFIQ BIN AZMI",
        "ic_number": "920101-10-5433"
      },
      "gross_commission": 2450.50,
      "total_deductions": 150.00,
      "final_amount_to_pay": 2300.50,
      "batch": {
        "batch_name": "COMMISSION BATCH JUN 2026",
        "month": 6,
        "year": 2026
      },
      "commission_records": [
        {
          "dispatcher_id": "DSP1004",
          "parcel_qty": 350,
          "net_parcel": 350,
          "commission_rate": 1.11,
          "total_commission": 388.50,
          "nett_commission": 388.50
        }
      ],
      "deduction_records": [
        {
          "dispatcher_id": "DSP1004",
          "deduction_hq_penalty": 50.00,
          "deduction_lost_parcel_hub": 100.00,
          "remark": "Barang hilang di Hub Rawang"
        }
      ]
    }
    ```
*   **Response (404 Not Found)**:
    ```json
    {
      "success": false,
      "code": "NOT_FOUND",
      "error": "Rekod komisen tidak ditemui bagi IC tersebut di dalam mana-mana batch aktif."
    }
    ```

---

## 6. Endpoints Log Audit (Admin Logs)

### A. Ambil Senarai Log Audit (`GET /api/admin/audit-logs`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Query Parameters**:
    *   `limit` (default: 100)
    *   `offset` (default: 0)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "logs": [
        {
          "id": 45,
          "timestamp": "2026-07-11T12:35:10Z",
          "username": "admin",
          "action": "IMPORT_BATCH",
          "details": "Membina batch baru COMMISSION BATCH JUN 2026 (ID: b1b7021b-cfc1-4770-b74a-7186178c78c3)"
        }
      ]
    }
    ```

### B. Padam Semua Log Audit (`DELETE /api/admin/audit-logs`)
*   **Akses**: Admin Sahaja (JWT Required)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Semua log audit berjaya dikosongkan."
    }
    ```
