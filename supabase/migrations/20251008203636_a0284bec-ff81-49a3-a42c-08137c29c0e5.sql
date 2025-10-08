-- Add guide_validity_date column to patients table
ALTER TABLE public.patients
ADD COLUMN guide_validity_date date;