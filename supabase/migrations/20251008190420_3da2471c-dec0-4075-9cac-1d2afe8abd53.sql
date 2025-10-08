-- Drop all policies that depend on app_role
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and doctors view all patients" ON public.patients;
DROP POLICY IF EXISTS "Secretaries view scheduling info" ON public.patients;
DROP POLICY IF EXISTS "Secretaries and admins can create patients" ON public.patients;
DROP POLICY IF EXISTS "Secretaries and admins can update patients" ON public.patients;
DROP POLICY IF EXISTS "Only admins can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Secretaries and admins can upload files" ON public.patient_files;
DROP POLICY IF EXISTS "Admins can delete files" ON public.patient_files;
DROP POLICY IF EXISTS "Secretaries and admins can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete patient files" ON storage.objects;

-- Drop and recreate has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Rename old enum and create new one
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- Update user_roles table to use new enum
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE app_role USING 
    CASE 
      WHEN role::text IN ('admin') THEN 'admin'::app_role
      ELSE 'user'::app_role
    END;

-- Drop old enum
DROP TYPE app_role_old CASCADE;

-- Recreate has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate RLS policies on user_roles
CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate RLS policies on patients - all authenticated users can view and modify
CREATE POLICY "Authenticated users can view patients" 
ON public.patients 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update patients" 
ON public.patients 
FOR UPDATE 
USING (is_authenticated_user());

CREATE POLICY "Only admins can delete patients" 
ON public.patients 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate RLS policies on patient_files
CREATE POLICY "Authenticated users can upload files" 
ON public.patient_files 
FOR INSERT 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Admins can delete files" 
ON public.patient_files 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate storage policies
CREATE POLICY "Authenticated users can upload patient files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'patient-files' AND is_authenticated_user());

CREATE POLICY "Admins can delete patient files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'patient-files' AND has_role(auth.uid(), 'admin'::app_role));