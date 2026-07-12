-- Migration: Add Search Hardening Indexes
-- Description: Creates composite indexes on batches, commission_records, and search_history tables.

CREATE INDEX IF NOT EXISTS idx_commission_batch_ic ON commission_records(batch_id, ic_number);
CREATE INDEX IF NOT EXISTS idx_commission_batch_dispatcher ON commission_records(batch_id, dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_deduction_batch_ic ON deduction_records(batch_id, ic_number);
CREATE INDEX IF NOT EXISTS idx_deduction_batch_dispatcher ON deduction_records(batch_id, dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_user ON search_history(created_at, user_id);
