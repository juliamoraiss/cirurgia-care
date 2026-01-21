-- Update user 5402ab0a-6fea-46c3-bb6a-5f8c0ce7172e to 'doctor' role
UPDATE public.user_roles 
SET role = 'doctor'::app_role 
WHERE user_id = '5402ab0a-6fea-46c3-bb6a-5f8c0ce7172e';

-- Update remaining 'user' roles to 'doctor'
UPDATE public.user_roles 
SET role = 'doctor'::app_role 
WHERE role = 'user'::app_role;

-- Update is_authenticated_user function to include doctor and dentist roles
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'doctor'::app_role, 'dentist'::app_role)
  )
$$;

-- Update assign_default_role to assign based on user_type
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_type_val TEXT;
  new_role app_role;
BEGIN
  -- Get user_type from the profile
  user_type_val := NEW.user_type;
  
  -- Determine role based on user_type
  IF user_type_val = 'dentista' THEN
    new_role := 'dentist'::app_role;
  ELSE
    new_role := 'doctor'::app_role;
  END IF;
  
  -- Only assign role if user doesn't already have one (new signup)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, new_role);
  END IF;
  RETURN NEW;
END;
$$;