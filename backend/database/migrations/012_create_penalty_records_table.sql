-- 012_create_penalty_records_table.sql
-- Description: Sets up the penalty_records table for Excel uploads of AWB-level details.

CREATE TABLE IF NOT EXISTS penalty_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_dispatcher_id VARCHAR(100) NOT NULL,
    delivery_dispatcher_name VARCHAR(255) NOT NULL,
    awb VARCHAR(100) UNIQUE NOT NULL,
    fake_return NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    fake_problematic NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    fraud_delivery NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    arbitration NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    individual_lost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    logic NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast searching and summing by Delivery Dispatcher ID
CREATE INDEX IF NOT EXISTS idx_penalty_records_dispatcher_id ON penalty_records(delivery_dispatcher_id);
