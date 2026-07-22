-- 013_alter_penalty_records_logic_to_text.sql
-- Description: Alters penalty_records table to change 'logic' column from NUMERIC to TEXT to support textual penalty descriptions.

ALTER TABLE penalty_records ALTER COLUMN logic TYPE TEXT USING logic::TEXT;
ALTER TABLE penalty_records ALTER COLUMN logic SET DEFAULT '';
