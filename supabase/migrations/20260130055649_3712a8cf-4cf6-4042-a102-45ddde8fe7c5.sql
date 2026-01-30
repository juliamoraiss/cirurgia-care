-- Drop the existing SELECT policy that's RESTRICTIVE
DROP POLICY IF EXISTS "Users can view oncology timeline for their patients or admins v" ON public.oncology_timeline;

-- Recreate it as PERMISSIVE
CREATE POLICY "Users can view oncology timeline for their patients or admins" 
ON public.oncology_timeline 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  ))
);

-- Also fix UPDATE policy
DROP POLICY IF EXISTS "Users can update oncology timeline events" ON public.oncology_timeline;

CREATE POLICY "Users can update oncology timeline events" 
ON public.oncology_timeline 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  ))
);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Only admins can delete oncology timeline events" ON public.oncology_timeline;

CREATE POLICY "Only admins can delete oncology timeline events" 
ON public.oncology_timeline 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));