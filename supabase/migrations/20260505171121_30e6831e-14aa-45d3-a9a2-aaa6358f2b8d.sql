
-- Tighten storage INSERT policies to require patient ownership (folder = patient_id)
DROP POLICY IF EXISTS "Users can upload patient files for their patients or admins upl" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient files" ON storage.objects;

CREATE POLICY "Users upload patient-files only for their own patients"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.responsible_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can upload feedback images for their patients or admins u" ON storage.objects;

CREATE POLICY "Users upload patient-feedbacks only for their own patients"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-feedbacks'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.responsible_user_id = auth.uid()
    )
  )
);

-- Restrict chat_leads SELECT to admins only (lead contact data)
DROP POLICY IF EXISTS "Authenticated users can view chat leads" ON public.chat_leads;
CREATE POLICY "Only admins can view chat leads"
ON public.chat_leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
