-- 011_rename_deduction_advance_to_others.sql
-- Renames column deduction_advance to deduction_others in public.commission_records and public.deduction_records

ALTER TABLE commission_records RENAME COLUMN deduction_advance TO deduction_others;
ALTER TABLE deduction_records RENAME COLUMN deduction_advance TO deduction_others;
