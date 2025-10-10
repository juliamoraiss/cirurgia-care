-- Update log_patient_changes to avoid NULL changed_by when called by system/service
CREATE OR REPLACE FUNCTION public.log_patient_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::TEXT, NEW.status::TEXT, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
  
  IF OLD.surgery_date IS DISTINCT FROM NEW.surgery_date THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'surgery_date', OLD.surgery_date::TEXT, NEW.surgery_date::TEXT, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-run the edge function now that logging won't fail
SELECT
  net.http_post(
      url:='https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/update-completed-surgeries',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;