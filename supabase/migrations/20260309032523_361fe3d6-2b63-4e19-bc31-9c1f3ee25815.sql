-- Fix scheduling_links RLS to allow secure link creation for responsible professional and admins
-- while avoiding restrictive-policy conflicts on INSERT.

DROP POLICY IF EXISTS "Admins can manage all scheduling_links" ON public.scheduling_links;
DROP POLICY IF EXISTS "Users can create scheduling_links for their patients" ON public.scheduling_links;
DROP POLICY IF EXISTS "Users can view scheduling_links for their patients" ON public.scheduling_links;

-- Admin full access
CREATE POLICY "Admins can manage all scheduling_links"
ON public.scheduling_links
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert allowed for responsible professional or admin
-- Also enforces doctor_id to match patient.responsible_user_id for integrity.
CREATE POLICY "Users can create scheduling_links for their patients"
ON public.scheduling_links
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = scheduling_links.patient_id
      AND p.responsible_user_id = scheduling_links.doctor_id
      AND (
        p.responsible_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

-- Read allowed for responsible professional, patient owner, or admin
CREATE POLICY "Users can view scheduling_links for their patients"
ON public.scheduling_links
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  scheduling_links.doctor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = scheduling_links.patient_id
      AND p.responsible_user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);