# REEKOD Semak - Commission System Backend

Backend production API service for the REEKOD Semak - Commission System built using Node.js, Express, and PostgreSQL.

## Features & Technologies
- **Framework**: Express.js
- **Database**: PostgreSQL (pg client pool)
- **Security**: Helmet, CORS, Express Rate Limit, BCrypt hashing
- **Data & Parsing**: SheetJS (xlsx), Multer (file uploading)
- **Utilities**: Morgan logging, Compression, Cookie Parser
- **Design Pattern**: Service Layer & Repository Pattern

## Directory Structure
```text
backend/
 ├── src/
 │   ├── config/          # Configurations (database, environments)
 │   ├── controllers/     # Controller handlers (Request/Response)
 │   ├── middleware/      # Middlewares (error handling, auth, rate-limiters)
 │   ├── models/          # Data schemas/models
 │   ├── repositories/    # Database query access layers (SQL)
 │   ├── routes/          # Express route bindings
 │   ├── services/        # Business logic services
 │   ├── utils/           # Shared utility modules
 │   ├── app.js           # App setup & middleware routing
 │   └── server.js        # Server bootstrapper & process signal handling
 ├── package.json         # Dependencies & scripts
 ├── .env.example         # Environmental configuration template
 └── README.md            # Installation & instruction documentation
```

## Setup Instructions

### 1. Prerequisites
- Node.js (version 18 or above recommended)
- PostgreSQL database instance

### 2. Environment Configuration
Copy the template configuration and set your database connection details:
```bash
cp .env.example .env
```
Update the `.env` file with your specific PostgreSQL settings:
- `PORT` (default: 5000)
- `NODE_ENV` (`development` or `production`)
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- `JWT_SECRET` (used for signing and verification of authentication tokens)

### 3. Installation
Navigate to the `backend` directory and install the packages:
```bash
cd backend
npm install
```

### 4. Running the Server

#### Development Mode (with hot reloading via nodemon):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

## API Endpoints

### Health check
- **Endpoint**: `GET /api/health`
- **Access**: Public
- **Description**: Verifies that the server is up and the PostgreSQL database pool connects successfully.
- **Response**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "version": "1.0.0"
  }
  ```
