-- 010_add_extra_reward_column.sql
-- Description: Adds addition_extra_reward column to commission_records,
-- and relaxes batches table status check constraint to support 'IMPORTED' state.

-- 1. Add extra reward column to commission_records
ALTER TABLE commission_records 
    ADD COLUMN IF NOT EXISTS addition_extra_reward NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

-- 2. Relax status check constraint on batches table
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'IMPORTED'));
