-- Drop the existing INSERT policy that's RESTRICTIVE
DROP POLICY IF EXISTS "Users can create oncology timeline events" ON public.oncology_timeline;

-- Recreate it as PERMISSIVE (which is the default)
CREATE POLICY "Users can create oncology timeline events" 
ON public.oncology_timeline 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  ))
);