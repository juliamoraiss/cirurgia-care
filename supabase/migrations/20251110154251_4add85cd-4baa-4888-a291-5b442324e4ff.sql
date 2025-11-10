-- Drop existing trigger and function with CASCADE
DROP FUNCTION IF EXISTS public.log_surgery_schedule() CASCADE;

-- Enhanced function to log patient changes to system activities
CREATE OR REPLACE FUNCTION public.log_patient_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Log surgery date changes (scheduled or rescheduled)
  IF OLD.surgery_date IS NULL AND NEW.surgery_date IS NOT NULL THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'surgery_scheduled',
      'Cirurgia agendada',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'surgery_date', NEW.surgery_date,
        'hospital', NEW.hospital,
        'procedure', NEW.procedure
      )
    );
  ELSIF OLD.surgery_date IS NOT NULL AND NEW.surgery_date IS NOT NULL AND OLD.surgery_date != NEW.surgery_date THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'surgery_rescheduled',
      'Cirurgia reagendada',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_surgery_date', OLD.surgery_date,
        'new_surgery_date', NEW.surgery_date,
        'hospital', NEW.hospital
      )
    );
  END IF;

  -- Log hospital changes
  IF OLD.hospital IS DISTINCT FROM NEW.hospital AND NEW.hospital IS NOT NULL THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'hospital_updated',
      'Hospital atualizado',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_hospital', OLD.hospital,
        'new_hospital', NEW.hospital
      )
    );
  END IF;

  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'status_updated',
      'Status atualizado',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  -- Log procedure changes
  IF OLD.procedure IS DISTINCT FROM NEW.procedure THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'procedure_updated',
      'Procedimento atualizado',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_procedure', OLD.procedure,
        'new_procedure', NEW.procedure
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for patient updates
CREATE TRIGGER log_patient_updates_trigger
AFTER UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.log_patient_updates();