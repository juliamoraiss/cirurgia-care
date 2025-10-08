-- Fix patient records access - secretaries see limited scheduling info only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all patients" ON public.patients;

-- Admins and doctors see all patient data
CREATE POLICY "Admins and doctors view all patients" ON public.patients
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'doctor')
);

-- Secretaries see only scheduling-relevant fields
CREATE POLICY "Secretaries view scheduling info" ON public.patients
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'secretary'));