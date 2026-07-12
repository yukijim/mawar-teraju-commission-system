-- Migration: Create batches, dispatcher_mappings, commission_records, and deduction_records tables
-- Description: Sets up the tables for Excel imports, enforcing UUIDs and strict relational checks

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    filename VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('COMMISSION', 'DEDUCTION')),
    checksum VARCHAR(64) UNIQUE NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index batch name, active flag, and checksum for lookup
CREATE INDEX IF NOT EXISTS idx_batches_name ON batches(name);
CREATE INDEX IF NOT EXISTS idx_batches_active ON batches(active);
CREATE INDEX IF NOT EXISTS idx_batches_checksum ON batches(checksum);

-- Create dispatcher_mappings table (source of truth linking dispatcher_id to NRIC ic_number)
CREATE TABLE IF NOT EXISTS dispatcher_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatcher_id VARCHAR(100) UNIQUE NOT NULL,
    ic_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatcher_mappings_ic ON dispatcher_mappings(ic_number);

-- Create commission_records table (stores pre-calculated commission rows, linked to batch)
CREATE TABLE IF NOT EXISTS commission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    dispatcher_id VARCHAR(100) NOT NULL,
    ic_number VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Volume & Base Commissions
    parcel_qty INTEGER NOT NULL DEFAULT 0,
    net_parcel INTEGER NOT NULL DEFAULT 0,
    exclude_extra_weight_yoyi INTEGER NOT NULL DEFAULT 0,
    commission_rate NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    diff_rate_new_joiner NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    count_pickup INTEGER NOT NULL DEFAULT 0,
    extra_weight_commission NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_commission NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- Additions
    addition_pickup_commission NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    addition_fuel_allowance NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    addition_sorter NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- Deductions
    deduction_advance NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_pending_cod NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_hq_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_duitnow_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_late_cod_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_lost_individual NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_lost_parcel_hub NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- Totals
    nett_commission NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    final_amount_to_pay NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- Metadata
    system_reg VARCHAR(100) NULL,
    parcel_qty_jms INTEGER NOT NULL DEFAULT 0,
    status_payment VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    date_payment VARCHAR(50) NULL,
    remark TEXT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate NRIC entry per batch
    CONSTRAINT uq_commission_batch_ic UNIQUE (batch_id, ic_number)
);

CREATE INDEX IF NOT EXISTS idx_commission_records_batch ON commission_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_ic ON commission_records(ic_number);
CREATE INDEX IF NOT EXISTS idx_commission_records_disp ON commission_records(dispatcher_id);

-- Create deduction_records table (stores detailed daily penalty rows, linked to batch)
CREATE TABLE IF NOT EXISTS deduction_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    dispatcher_id VARCHAR(100) NOT NULL,
    ic_number VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- General Deductions
    deduction_advance NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_pending_cod NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_hq_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_duitnow_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_late_cod_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_lost_individual NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    deduction_lost_parcel_hub NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- Details Penalty columns from Excel
    lost_pic_signed NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    lost_rate NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_all_lost_shared NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    lost_parcel_pic_signed NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    arbi_individual NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    rcgen_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    qc_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    total_hq_penalty_detail NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate NRIC entry per batch
    CONSTRAINT uq_deduction_batch_ic UNIQUE (batch_id, ic_number)
);

CREATE INDEX IF NOT EXISTS idx_deduction_records_batch ON deduction_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_deduction_records_ic ON deduction_records(ic_number);
CREATE INDEX IF NOT EXISTS idx_deduction_records_disp ON deduction_records(dispatcher_id);
