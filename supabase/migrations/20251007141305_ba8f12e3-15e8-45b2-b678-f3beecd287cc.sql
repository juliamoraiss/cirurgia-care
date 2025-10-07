-- Fix function search_path for security definer functions with CASCADE
-- This prevents potential security issues with function execution

-- Drop and recreate has_role function with CASCADE to handle dependent policies
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate all policies that depend on has_role
-- User roles table policies
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Patients table policies
CREATE POLICY "Secretaries and admins can create patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'secretary'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaries and admins can update patients" ON public.patients
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'secretary'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete patients" ON public.patients
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Patient files table policies
CREATE POLICY "Secretaries and admins can upload files" ON public.patient_files
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'secretary'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete files" ON public.patient_files
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies (recreate with proper syntax)
DROP POLICY IF EXISTS "Secretaries and admins can upload patient files" ON storage.objects;
CREATE POLICY "Secretaries and admins can upload patient files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-files' 
  AND (has_role(auth.uid(), 'secretary'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can delete patient files" ON storage.objects;
CREATE POLICY "Admins can delete patient files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-files'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Update is_authenticated_user function with proper search_path
DROP FUNCTION IF EXISTS public.is_authenticated_user() CASCADE;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
  )
$$;

-- Recreate dependent policies for is_authenticated_user
CREATE POLICY "Authenticated users can view all patients" ON public.patients
FOR SELECT TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can view patient files" ON public.patient_files
FOR SELECT TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can view history" ON public.patient_history
FOR SELECT TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can view patient files in storage" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'patient-files' AND is_authenticated_user());

-- Update handle_new_user function with proper search_path
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update log_patient_changes function with proper search_path
DROP FUNCTION IF EXISTS public.log_patient_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.log_patient_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::TEXT, NEW.status::TEXT, auth.uid());
  END IF;
  
  IF OLD.surgery_date IS DISTINCT FROM NEW.surgery_date THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'surgery_date', OLD.surgery_date::TEXT, NEW.surgery_date::TEXT, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER log_patient_changes_trigger
  AFTER UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.log_patient_changes();