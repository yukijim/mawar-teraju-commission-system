-- Migration: Add enterprise batch management columns to batches table
-- Description: Alters the batches table to support versioning, progress, active flags, and rollback relations.

ALTER TABLE batches 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS published_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS previous_batch_id UUID NULL REFERENCES batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

-- Index the enterprise columns for faster query performance
CREATE INDEX IF NOT EXISTS idx_batches_is_active ON batches(is_active);
CREATE INDEX IF NOT EXISTS idx_batches_previous_batch_id ON batches(previous_batch_id);
