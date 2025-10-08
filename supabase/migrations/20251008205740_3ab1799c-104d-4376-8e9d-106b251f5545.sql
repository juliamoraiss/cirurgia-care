-- Fix search_path for all remaining functions

-- Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update log_patient_changes trigger function
CREATE OR REPLACE FUNCTION public.log_patient_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;