-- 007_align_deduction_records.sql
-- Safely aligns the database tables on the production database.
-- Run this on the production PostgreSQL database.

-- 1. Drop constraints on ic_number uniqueness in dispatcher_mappings to support 1-to-many lookup
ALTER TABLE dispatcher_mappings DROP CONSTRAINT IF EXISTS dispatcher_mappings_ic_number_key;
ALTER TABLE dispatcher_mappings DROP CONSTRAINT IF EXISTS dispatcher_mappings_ic_number_uniq;

-- 2. Check and rename legacy snapshot columns if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='ic_no_snapshot') THEN
        ALTER TABLE deduction_records RENAME COLUMN ic_no_snapshot TO ic_number;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='name_snapshot') THEN
        ALTER TABLE deduction_records RENAME COLUMN name_snapshot TO name;
    END IF;
END $$;

-- 3. Check and add new columns if they do not exist
ALTER TABLE deduction_records 
    ADD COLUMN IF NOT EXISTS ic_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS deduction_advance NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_pending_cod NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_hq_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_duitnow_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_late_cod_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_lost_individual NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_lost_parcel_hub NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS lost_pic_signed NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS lost_rate NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS total_all_lost_shared NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS lost_parcel_pic_signed NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS arbi_individual NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS rcgen_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS qc_penalty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS total_hq_penalty_detail NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 4. Set NOT NULL constraints on ic_number and name once columns are filled/verified
-- Note: Set values to default empty strings first if there are existing rows to avoid null constraints failures
UPDATE deduction_records SET ic_number = '' WHERE ic_number IS NULL;
UPDATE deduction_records SET name = '' WHERE name IS NULL;

ALTER TABLE deduction_records 
    ALTER COLUMN ic_number SET NOT NULL,
    ALTER COLUMN name SET NOT NULL;

-- 5. Check and drop obsolete legacy columns if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='total_deduction') THEN
        ALTER TABLE deduction_records DROP COLUMN total_deduction;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='advance') THEN
        ALTER TABLE deduction_records DROP COLUMN advance;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='pending_cod') THEN
        ALTER TABLE deduction_records DROP COLUMN pending_cod;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='hq_penalty') THEN
        ALTER TABLE deduction_records DROP COLUMN hq_penalty;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='duitnow_penalty') THEN
        ALTER TABLE deduction_records DROP COLUMN duitnow_penalty;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='late_cod_penalty') THEN
        ALTER TABLE deduction_records DROP COLUMN late_cod_penalty;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='lost_individual') THEN
        ALTER TABLE deduction_records DROP COLUMN lost_individual;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deduction_records' AND column_name='lost_parcel_hub') THEN
        ALTER TABLE deduction_records DROP COLUMN lost_parcel_hub;
    END IF;
END $$;
