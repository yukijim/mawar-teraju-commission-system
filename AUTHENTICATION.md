# Authentication & Authorization Module Documentation

This document explains the technical implementation, database structures, and configuration details for the Authentication and Authorization module in the Mawar Teraju Commission System.

---

## 1. Directory Structure

The module is implemented in the `/backend` folder using the Repository-Service-Controller architecture:
```text
backend/
 ├── database/
 │   ├── migrations/
 │   │   └── 001_create_users_table.sql # SQL Migrations DDL (UUIDs)
 │   └── seed.js                         # Database admin seed script
 ├── src/
 │   ├── controllers/
 │   │   └── authController.js           # Express handlers, cookie manager
 │   ├── middleware/
 │   │   ├── auth.js                      # authenticate() & authorize() guards
 │   │   ├── error.js                     # Standardized error format handler
 │   │   └── rateLimiter.js               # Route-specific rate limiters
 │   ├── repositories/
 │   │   ├── userRepository.js            # User CRUD & session database queries
 │   │   └── auditLogRepository.js       # Writes security events to DB
 │   ├── routes/
 │   │   ├── auth.js                      # /api/auth routes & validation
 │   │   ├── admin.js                     # Protected /api/admin routes
 │   │   └── dispatch.js                  # Protected /api/dispatch routes
 │   ├── services/
 │   │   ├── authService.js               # Hashing, token signs, login logic
 │   │   └── auditLogService.js           # Standardizes metadata & actions
 │   └── utils/
 │       └── response.js                  # Consistent JSON envelope helper
 └── tests/
     └── auth.test.js                     # Automated security integration tests
```

---

## 2. Database Schema

### Table: `users`
Represents the system users (Pentadbir & Dispatcher).
- `id` (UUID): Primary key, defaults to `gen_random_uuid()`.
- `full_name` (VARCHAR): Full name of the user.
- `username` (VARCHAR): Unique login handle.
- `password_hash` (VARCHAR): Encrypted password using Bcrypt (12 rounds).
- `role` (VARCHAR): Permitted roles: `ADMIN` or `DISPATCH`.
- `status` (VARCHAR): Status of account: `ACTIVE` or `INACTIVE` (suspended).
- `created_at` / `updated_at`: Date timestamps.

### Table: `user_refresh_tokens`
Manages token rotation and revocation.
- `id` (UUID): Primary key, defaults to `gen_random_uuid()`.
- `user_id` (UUID): Reference key to `users(id)` (cascade delete).
- `token_hash` (TEXT): SHA-256 one-way cryptographic hash of the refresh token.
- `expires_at` (TIMESTAMP WITH TIME ZONE): Expiration timestamp.
- `revoked_at` (TIMESTAMP WITH TIME ZONE): Set when a user logs out or session is rotated.
- `created_at` (TIMESTAMP WITH TIME ZONE): Date timestamp.

### Table: `audit_logs`
Saves security trails.
- `id` (UUID): Primary key, defaults to `gen_random_uuid()`.
- `user_id` (UUID NULL): Reference key to `users(id)` (set null on delete).
- `action` (VARCHAR): Event tags (e.g. `LOGIN_SUCCESS`, `INVALID_JWT`).
- `ip_address` (VARCHAR): Client IP address.
- `user_agent` (VARCHAR): Client browser signature.
- `status` (VARCHAR): Result status (`SUCCESS` or `FAILED`).
- `details` (JSONB): Dynamic JSON metadata.
- `created_at` (TIMESTAMP WITH TIME ZONE): Timestamp.

---

## 3. API Endpoints

All auth endpoints are mounted under `/api/auth`:

### A. Login
- **Endpoint**: `POST /api/auth/login`
- **Rate Limit**: Max 5 requests per minute (`loginLimiter`).
- **Validation**: Username (3-100 characters, XSS-escaped), Password (required).
- **Behavior**: Verifies credentials, generates access token (15m) and refresh token (7d). Writes tokens to HTTP-only cookies and returns user details.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User logged in successfully.",
    "data": {
      "user": { "id": "uuid-value", "username": "admin", "role": "ADMIN", "status": "ACTIVE" },
      "accessToken": "ey...",
      "refreshToken": "ey..."
    }
  }
  ```

### B. Logout
- **Endpoint**: `POST /api/auth/logout`
- **Access**: Protected.
- **Behavior**: Retrieves active refresh token from cookies, marks the token as revoked in the database (`revoked_at = CURRENT_TIMESTAMP`), clears all cookies, and logs the `LOGOUT` action.

### C. Refresh Session
- **Endpoint**: `POST /api/auth/refresh`
- **Rate Limit**: Max 5 requests per minute (`loginLimiter`).
- **Behavior**: Verifies the refresh token signature, checks if the token hash exists in the database and is active, generates a new access token, and updates the cookie.

### D. Get Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Access**: Protected.
- **Behavior**: Returns the active profile of the logged-in user.

---

## 4. API Error Response Standard

Every error returned by the backend backend complies with the standardized schema:
```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid username or password.",
  "errors": []
}
```

### Core Error Codes:
- `AUTH_MISSING_TOKEN`: No access token cookie or header was supplied.
- `AUTH_INVALID_TOKEN`: Signature verification failed or token is malformed.
- `AUTH_EXPIRED_TOKEN`: Access token has expired.
- `AUTH_USER_NOT_FOUND`: Token belongs to a user that no longer exists in the DB.
- `AUTH_USER_DEACTIVATED`: Account has been suspended.
- `AUTH_FORBIDDEN`: User does not hold the required role.
- `AUTH_VALIDATION_ERROR`: Input payload failed schema validations (details in `errors` array).
- `AUTH_RATE_LIMIT_EXCEEDED`: Route-specific rate limiter blocked the request.

---

## 5. Setting Up the Database & Seeding

### 1. Migrations
Load the SQL schema into your active PostgreSQL database instance:
```bash
psql -U postgres -d mawar_teraju_db -f database/migrations/001_create_users_table.sql
```

### 2. Environment Variables Configuration
Configure your credentials in `/backend/.env` (copied from `.env.example`):
```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456
JWT_SECRET=supersecret_access_key
JWT_REFRESH_SECRET=supersecret_refresh_key
```

### 3. Seed Default Credentials
Execute the seeding script to create the initial admin user securely:
```bash
node database/seed.js
```
The script will fetch credentials from `.env`. If they are not specified, it will abort with a clear error:
`[Seed Failure] Aborting database seeding. Environment variables "DEFAULT_ADMIN_USERNAME" and "DEFAULT_ADMIN_PASSWORD" must be defined in the .env file.`
