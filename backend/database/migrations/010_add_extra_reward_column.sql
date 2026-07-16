-- 010_add_extra_reward_column.sql
-- Description: Adds addition_extra_reward column to commission_records

ALTER TABLE commission_records 
    ADD COLUMN IF NOT EXISTS addition_extra_reward NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;
