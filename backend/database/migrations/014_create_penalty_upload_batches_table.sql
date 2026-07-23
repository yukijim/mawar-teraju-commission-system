-- Migration: 014_create_penalty_upload_batches_table.sql
-- Description: Creates penalty_upload_batches table to log penalty Excel file upload history.

CREATE TABLE IF NOT EXISTS penalty_upload_batches (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    records_imported INT NOT NULL DEFAULT 0,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_upload_batches_uploaded_at ON penalty_upload_batches(uploaded_at DESC);
