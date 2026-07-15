-- 008_relax_batch_ic_constraints.sql
-- Safely drops any remaining unique constraints using ic_number on commission_records and deduction_records tables
-- and replaces them with unique constraints on (batch_id, dispatcher_id).

-- 1. Drop constraints on commission_records
ALTER TABLE commission_records DROP CONSTRAINT IF EXISTS uq_commission_batch_ic;
ALTER TABLE commission_records DROP CONSTRAINT IF EXISTS commission_records_batch_id_ic_number_key;
ALTER TABLE commission_records DROP CONSTRAINT IF EXISTS commission_records_ic_number_key;

-- 2. Drop constraints on deduction_records
ALTER TABLE deduction_records DROP CONSTRAINT IF EXISTS uq_deduction_batch_ic;
ALTER TABLE deduction_records DROP CONSTRAINT IF EXISTS deduction_records_batch_id_ic_number_key;
ALTER TABLE deduction_records DROP CONSTRAINT IF EXISTS deduction_records_ic_number_key;

-- 3. Add correct unique constraints based on dispatcher_id (1 dispatcher can have only 1 row per batch)
ALTER TABLE commission_records DROP CONSTRAINT IF EXISTS uq_commission_batch_dispatcher;
ALTER TABLE commission_records ADD CONSTRAINT uq_commission_batch_dispatcher UNIQUE (batch_id, dispatcher_id);

ALTER TABLE deduction_records DROP CONSTRAINT IF EXISTS uq_deduction_batch_dispatcher;
ALTER TABLE deduction_records ADD CONSTRAINT uq_deduction_batch_dispatcher UNIQUE (batch_id, dispatcher_id);
