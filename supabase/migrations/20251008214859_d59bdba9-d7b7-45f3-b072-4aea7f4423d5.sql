-- Add gender column to patients table
ALTER TABLE public.patients 
ADD COLUMN gender TEXT CHECK (gender IN ('masculino', 'feminino'));