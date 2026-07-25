-- 015_add_lost_parcel_arbitration_and_road.sql
-- Adds deduction_lost_parcel_arbitration and deduction_lost_parcel_road columns to deduction_records table

ALTER TABLE deduction_records 
    ADD COLUMN IF NOT EXISTS deduction_lost_parcel_arbitration NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS deduction_lost_parcel_road NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;
