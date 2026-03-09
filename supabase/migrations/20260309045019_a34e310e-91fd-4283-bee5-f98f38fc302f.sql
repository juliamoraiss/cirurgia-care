
CREATE OR REPLACE FUNCTION public.revert_status_on_surgery_date_clear()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- When surgery_date is cleared and status is surgery_scheduled or pending_scheduling, revert to authorized
  IF OLD.surgery_date IS NOT NULL AND NEW.surgery_date IS NULL 
     AND OLD.status IN ('surgery_scheduled', 'pending_scheduling') THEN
    NEW.status := 'authorized';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER revert_status_on_surgery_clear
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_status_on_surgery_date_clear();
