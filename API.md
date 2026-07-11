# Antara Muka Pengaturcaraan Aplikasi (API)

> [!NOTE]
> **Status Semasa: Cadangan Integrasi (Future Implementation - Sprint 2)**
> Pada masa ini, sistem beroperasi 100% di bahagian pelanggan (client-side) menggunakan pangkalan data tempatan browser (IndexedDB). Tiada pelayan backend (backend server) yang aktif.

Dokumen ini menyediakan spesifikasi reka bentuk konseptual API RESTful sekiranya sistem akan dinaik taraf menggunakan seni bina Pelayan-Pelanggan (Client-Server) pada masa hadapan (Sprint 2).

---

## Spesifikasi Protokol API (Proposed REST API)

*   **Protokol**: HTTPS
*   **Format Data**: JSON (`Content-Type: application/json`)
*   **Pengesahan**: Token Bearer JWT (`Authorization: Bearer <token>`)

---

## Senarai Endpoints Konseptual (Sprint 2 Endpoints)

### 1. Modul Pengesahan (Authentication)

#### A. Log Masuk Admin
*   **Endpoint**: `POST /api/v1/auth/login`
*   **Akses**: Had Akses Terbuka
*   **Request Body**:
    ```json
    {
      "password": "mawar_password"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1783360549782
    }
    ```

#### B. Tukar Kata Laluan
*   **Endpoint**: `PUT /api/v1/auth/password`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Request Body**:
    ```json
    {
      "old_password": "mawar123",
      "new_password": "new_secure_password"
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

### 2. Modul Pengurusan Batch Komisen (Commission Batch Management)

#### A. Cipta Draf Batch Baru
*   **Endpoint**: `POST /api/v1/batches`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Request Body**:
    ```json
    {
      "name": "Julai 2026"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "success": true,
      "batch_id": 12,
      "name": "Julai 2026",
      "status": "draft"
    }
    ```

#### B. Muat Naik Fail Excel ke Batch
*   **Endpoint**: `PUT /api/v1/batches/:id/upload`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Request Format**: `multipart/form-data`
*   **Fields**:
    *   `file`: (Binary Excel file)
    *   `type`: `"commission"` atau `"deduction"`
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "batch_id": 12,
      "type_uploaded": "commission",
      "filename": "commission_report.xlsx",
      "records_imported": 248
    }
    ```

#### C. Terbit & Aktifkan Batch (Publish Batch)
*   **Endpoint**: `POST /api/v1/batches/:id/publish`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Batch ID 12 berjaya diterbitkan dan diaktifkan. Batch lama dinyahaktifkan."
    }
    ```

#### D. Senarai Batch
*   **Endpoint**: `GET /api/v1/batches`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Response (200 OK)**:
    ```json
    [
      {
        "id": 12,
        "name": "Julai 2026",
        "status": "published",
        "active": 1,
        "commissionCount": 248,
        "deductionCount": 248,
        "commissionFilename": "commission_report.xlsx",
        "deductionFilename": "deductions_report.xlsx",
        "publishedTime": 1783430536579
      }
    ]
    ```

#### E. Padam/Rollback Batch
*   **Endpoint**: `DELETE /api/v1/batches/:id`
*   **Akses**: Perlu Token JWT (Admin Only)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Batch ID 12 dan semua rekod komisen/potongan berkaitan berjaya dipadamkan (Rollback)."
    }
    ```

---

### 3. Modul Carian Rider (Dispatcher Search)

#### A. Carian IC Dispatcher
*   **Endpoint**: `GET /api/v1/dispatch/search`
*   **Akses**: Had Akses Terbuka (Public)
*   **Parameters**:
    *   `ic`: `"900101141234"` (NRIC berformat bersih)
*   **Response (200 OK)**:
    ```json
    {
      "success": true,
      "batchName": "Julai 2026",
      "record": {
        "ic_number": "900101141234",
        "name": "Ahmad Bin Ali",
        "parcel_qty": 150,
        "net_parcel": 140,
        "commission_rate": 161.00,
        "total_commission": 181.00,
        "nett_commission": 161.00,
        "deduction_advance": 50.00,
        "deduction_hq_penalty": 10.00,
        "final_amount_to_pay": 101.00
      }
    }
    ```
