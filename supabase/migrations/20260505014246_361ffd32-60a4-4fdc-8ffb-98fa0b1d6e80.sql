
-- 1. Fix profiles self-update privilege escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For non-admins, prevent changes to privilege-related fields
  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Não é permitido alterar estes campos do perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Drop overly-broad storage SELECT policy on patient-files
DROP POLICY IF EXISTS "Authenticated users can view patient files" ON storage.objects;

-- 3. Restrict system_activities with NULL patient_id to admins only
DROP POLICY IF EXISTS "Users can view activities for their patients or admins view all" ON public.system_activities;
CREATE POLICY "Users can view activities for their patients or admins view all"
ON public.system_activities
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (patient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = system_activities.patient_id
      AND patients.responsible_user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can create activities for their patients or admins create" ON public.system_activities;
CREATE POLICY "Users can create activities for their patients or admins create"
ON public.system_activities
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (patient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = system_activities.patient_id
      AND patients.responsible_user_id = auth.uid()
  ))
);

-- 4. Restrict chat_leads INSERT to anonymous only (and admins via existing select policy)
DROP POLICY IF EXISTS "Anyone can submit a chat lead" ON public.chat_leads;
CREATE POLICY "Anonymous users can submit a chat lead"
ON public.chat_leads
FOR INSERT
TO anon
WITH CHECK (true);

-- 5. Lock down EXECUTE on SECURITY DEFINER functions: revoke from PUBLIC/anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_authenticated_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_user_with_username(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalize_name(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_approved(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_name(text) TO authenticated;
