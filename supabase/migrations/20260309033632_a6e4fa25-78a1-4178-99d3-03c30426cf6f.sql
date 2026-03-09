
-- Trigger function: create pre-op and post-op instruction tasks when surgery_date is set/changed
CREATE OR REPLACE FUNCTION public.create_surgery_instruction_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pre_op_due TIMESTAMP WITH TIME ZONE;
  post_op_due TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Only trigger when surgery_date is SET or CHANGED
  IF NEW.surgery_date IS NOT NULL AND (OLD.surgery_date IS NULL OR OLD.surgery_date != NEW.surgery_date) THEN
    
    -- Calculate pre-op due date: 1 day before surgery at midnight
    pre_op_due := (NEW.surgery_date - INTERVAL '1 day')::date::timestamp with time zone;
    
    -- If pre-op due date is in the past, set to now
    IF pre_op_due < now() THEN
      pre_op_due := now();
    END IF;
    
    -- Calculate post-op due date: 5 hours after surgery
    post_op_due := NEW.surgery_date + INTERVAL '5 hours';
    
    -- Delete existing incomplete pre-op task for this patient (to avoid duplicates on reschedule)
    DELETE FROM public.patient_tasks 
    WHERE patient_id = NEW.id 
      AND task_type = 'pre_op_instructions' 
      AND completed = false;
    
    -- Delete existing incomplete post-op task for this patient
    DELETE FROM public.patient_tasks 
    WHERE patient_id = NEW.id 
      AND task_type = 'post_op_instructions' 
      AND completed = false;
    
    -- Create pre-op instructions task
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'pre_op_instructions',
      'Enviar instruções pré-operatórias',
      'Enviar instruções ao paciente ' || NEW.name || ' para a cirurgia de ' || NEW.procedure,
      pre_op_due,
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
    
    -- Create post-op instructions task
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'post_op_instructions',
      'Enviar recomendações pós-operatórias',
      'Enviar recomendações ao paciente ' || NEW.name || ' após a cirurgia de ' || NEW.procedure,
      post_op_due,
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on patients table
DROP TRIGGER IF EXISTS on_surgery_date_set ON public.patients;
CREATE TRIGGER on_surgery_date_set
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_surgery_instruction_tasks();
