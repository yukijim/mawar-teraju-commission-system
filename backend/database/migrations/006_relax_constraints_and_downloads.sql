-- Drop constraints on ic_number uniqueness in dispatcher_mappings
ALTER TABLE dispatcher_mappings DROP CONSTRAINT IF EXISTS dispatcher_mappings_ic_number_key;
ALTER TABLE dispatcher_mappings DROP CONSTRAINT IF EXISTS dispatcher_mappings_ic_number_uniq;

-- Drop constraints uq_commission_batch_ic and uq_deduction_batch_ic (which prevent >1 dispatcher ID per IC in the same batch)
ALTER TABLE commission_records DROP CONSTRAINT IF EXISTS uq_commission_batch_ic;
ALTER TABLE deduction_records DROP CONSTRAINT IF EXISTS uq_deduction_batch_ic;

-- Add unique constraints on (batch_id, dispatcher_id) instead, as defined in owner's reference schema
ALTER TABLE commission_records ADD CONSTRAINT uq_commission_batch_dispatcher UNIQUE (batch_id, dispatcher_id);
ALTER TABLE deduction_records ADD CONSTRAINT uq_deduction_batch_dispatcher UNIQUE (batch_id, dispatcher_id);

-- Create report_downloads table as specified in reference schema
CREATE TABLE IF NOT EXISTS report_downloads (
    id SERIAL PRIMARY KEY,
    dispatcher_id VARCHAR(100) NOT NULL,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('COMMISSION', 'DEDUCTION')),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_downloads_dispatcher ON report_downloads(dispatcher_id);
