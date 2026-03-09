CREATE OR REPLACE FUNCTION public.auto_schedule_on_surgery_date_set()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.surgery_date IS NULL AND NEW.surgery_date IS NOT NULL 
     AND OLD.status IN ('authorized', 'pending_scheduling') THEN
    NEW.status := 'surgery_scheduled';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_schedule_status_on_surgery_date
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_schedule_on_surgery_date_set();