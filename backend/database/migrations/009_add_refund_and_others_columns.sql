-- 009_add_refund_and_others_columns.sql
-- Description: Adds addition_refund_penalty and addition_others columns to commission_records,
-- copies existing legacy data, and drops legacy mismatched columns addition_fuel_allowance and system_reg.

-- 1. Add addition_refund_penalty and addition_others columns as NUMERIC
ALTER TABLE commission_records 
    ADD COLUMN IF NOT EXISTS addition_refund_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS addition_others NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

-- 2. Migrate existing data from legacy columns to new columns
-- Copy addition_fuel_allowance to addition_refund_penalty
UPDATE commission_records 
SET addition_refund_penalty = addition_fuel_allowance;

-- Copy and clean system_reg string values to addition_others
UPDATE commission_records 
SET addition_others = CASE 
    WHEN system_reg IS NULL THEN 0.0000
    WHEN TRIM(system_reg) = '' THEN 0.0000
    WHEN TRIM(system_reg) = '-' THEN 0.0000
    ELSE COALESCE(NULLIF(regexp_replace(system_reg, '[^0-9.-]', '', 'g'), '')::NUMERIC, 0.0000)
END;

-- 3. Drop legacy mismatched columns
ALTER TABLE commission_records DROP COLUMN IF EXISTS addition_fuel_allowance;
ALTER TABLE commission_records DROP COLUMN IF EXISTS system_reg;
