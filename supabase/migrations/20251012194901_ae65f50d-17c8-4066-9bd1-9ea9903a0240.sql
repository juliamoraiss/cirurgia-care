-- Add DELETE policy for system_activities (only admins can delete)
CREATE POLICY "Only admins can delete activities"
ON public.system_activities
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));