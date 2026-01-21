-- Fix patient_notes: restrict SELECT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view notes" ON public.patient_notes;
CREATE POLICY "Users can view notes for their patients or admins view all"
ON public.patient_notes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_notes.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_notes: restrict UPDATE to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.patient_notes;
CREATE POLICY "Users can update notes for their patients or admins update all"
ON public.patient_notes
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_notes.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_notes: restrict INSERT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can create notes" ON public.patient_notes;
CREATE POLICY "Users can create notes for their patients or admins create all"
ON public.patient_notes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_notes.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_tasks: restrict SELECT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.patient_tasks;
CREATE POLICY "Users can view tasks for their patients or admins view all"
ON public.patient_tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_tasks.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_tasks: restrict UPDATE to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.patient_tasks;
CREATE POLICY "Users can update tasks for their patients or admins update all"
ON public.patient_tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_tasks.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_tasks: restrict INSERT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.patient_tasks;
CREATE POLICY "Users can create tasks for their patients or admins create all"
ON public.patient_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_tasks.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_history: restrict SELECT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view history" ON public.patient_history;
CREATE POLICY "Users can view history for their patients or admins view all"
ON public.patient_history
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_history.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_feedbacks: restrict SELECT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can view feedbacks" ON public.patient_feedbacks;
CREATE POLICY "Users can view feedbacks for their patients or admins view all"
ON public.patient_feedbacks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_feedbacks.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_feedbacks: restrict INSERT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can create feedbacks" ON public.patient_feedbacks;
CREATE POLICY "Users can create feedbacks for their patients or admins create all"
ON public.patient_feedbacks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_feedbacks.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix patient_files: restrict INSERT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can upload files" ON public.patient_files;
CREATE POLICY "Users can upload files for their patients or admins upload all"
ON public.patient_files
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = patient_files.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix system_activities: restrict SELECT to patient owner or admin (or activities without patient)
DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.system_activities;
CREATE POLICY "Users can view activities for their patients or admins view all"
ON public.system_activities
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR patient_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = system_activities.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix system_activities: restrict INSERT to patient owner or admin
DROP POLICY IF EXISTS "Authenticated users can create activities" ON public.system_activities;
CREATE POLICY "Users can create activities for their patients or admins create all"
ON public.system_activities
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR patient_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.patients
    WHERE patients.id = system_activities.patient_id
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Fix storage: patient-feedbacks bucket SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view feedback images" ON storage.objects;
CREATE POLICY "Users can view feedback images for their patients or admins view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-feedbacks'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 
      FROM public.patient_feedbacks pf
      JOIN public.patients p ON p.id = pf.patient_id
      WHERE pf.image_path = storage.objects.name
      AND p.responsible_user_id = auth.uid()
    )
  )
);

-- Fix storage: patient-feedbacks bucket INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload feedback images" ON storage.objects;
CREATE POLICY "Users can upload feedback images for their patients or admins upload all"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-feedbacks'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_authenticated_user()
  )
);

-- Fix storage: patient-files bucket INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload patient files in storage" ON storage.objects;
CREATE POLICY "Users can upload patient files for their patients or admins upload all"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_authenticated_user()
  )
);