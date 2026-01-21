-- Fix Issue 1: patient_files table SELECT policy - restrict to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view patient files" ON public.patient_files;

CREATE POLICY "Users can view files for their patients or admins view all"
ON public.patient_files
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_files.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix Issue 2: Storage bucket patient-files SELECT policy - restrict to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view patient files in storage" ON storage.objects;

CREATE POLICY "Users can view storage files for their patients or admins view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 
      FROM public.patient_files pf
      JOIN public.patients p ON p.id = pf.patient_id
      WHERE pf.file_path = storage.objects.name
      AND p.responsible_user_id = auth.uid()
    )
  )
);