-- Add responsible_user_id column to patients table
ALTER TABLE public.patients 
ADD COLUMN responsible_user_id uuid REFERENCES auth.users(id);

-- Update all existing patients to belong to André Morais Alves
UPDATE public.patients 
SET responsible_user_id = '4537559e-87e3-4656-8cf0-aa109714b6a8'::uuid
WHERE responsible_user_id IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE public.patients 
ALTER COLUMN responsible_user_id SET NOT NULL;

-- Create index for better query performance
CREATE INDEX idx_patients_responsible_user ON public.patients(responsible_user_id);

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;

-- Create new SELECT policy: admins see all, others see only their patients
CREATE POLICY "Users can view their own patients or admins can view all"
ON public.patients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR responsible_user_id = auth.uid()
);

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create patients" ON public.patients;

-- Create new INSERT policy
CREATE POLICY "Authenticated users can create patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (is_authenticated_user());

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;

-- Create new UPDATE policy: admins can update all, others only their patients
CREATE POLICY "Users can update their own patients or admins can update all"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR responsible_user_id = auth.uid()
);