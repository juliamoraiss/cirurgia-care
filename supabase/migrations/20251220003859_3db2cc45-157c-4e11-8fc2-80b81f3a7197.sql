-- Create function to auto-create task when guide_validity_date is set
CREATE OR REPLACE FUNCTION public.create_guide_expiry_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_due_date TIMESTAMP WITH TIME ZONE;
  existing_task_id UUID;
BEGIN
  -- Only trigger when guide_validity_date is set or changed
  IF NEW.guide_validity_date IS NOT NULL AND 
     (OLD.guide_validity_date IS NULL OR OLD.guide_validity_date != NEW.guide_validity_date) THEN
    
    -- Calculate due date: 25 days before expiry
    task_due_date := (NEW.guide_validity_date - INTERVAL '25 days')::TIMESTAMP WITH TIME ZONE;
    
    -- If due date is in the past, set it to today
    IF task_due_date < now() THEN
      task_due_date := now();
    END IF;
    
    -- Check if a similar task already exists (not completed)
    SELECT id INTO existing_task_id
    FROM public.patient_tasks
    WHERE patient_id = NEW.id
      AND task_type = 'guide_expiry_reminder'
      AND completed = false
    LIMIT 1;
    
    -- If task exists, update it; otherwise create new
    IF existing_task_id IS NOT NULL THEN
      UPDATE public.patient_tasks
      SET due_date = task_due_date,
          title = 'Cobrar exames e agendar cirurgia - Guia expira em ' || to_char(NEW.guide_validity_date, 'DD/MM/YYYY'),
          description = 'A guia do paciente expira em ' || to_char(NEW.guide_validity_date, 'DD/MM/YYYY') || '. Lembre-se de cobrar os exames pendentes e agendar a cirurgia antes do vencimento.',
          updated_at = now()
      WHERE id = existing_task_id;
    ELSE
      INSERT INTO public.patient_tasks (
        patient_id,
        title,
        description,
        task_type,
        due_date,
        created_by,
        completed
      ) VALUES (
        NEW.id,
        'Cobrar exames e agendar cirurgia - Guia expira em ' || to_char(NEW.guide_validity_date, 'DD/MM/YYYY'),
        'A guia do paciente expira em ' || to_char(NEW.guide_validity_date, 'DD/MM/YYYY') || '. Lembre-se de cobrar os exames pendentes e agendar a cirurgia antes do vencimento.',
        'guide_expiry_reminder',
        task_due_date,
        COALESCE(auth.uid(), NEW.created_by),
        false
      );
    END IF;
    
    -- Log the activity
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'guide_expiry_task_created',
      'Tarefa de lembrete de validade da guia criada automaticamente',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'guide_validity_date', NEW.guide_validity_date::text,
        'task_due_date', task_due_date::text
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for guide validity date
DROP TRIGGER IF EXISTS on_guide_validity_date_set ON public.patients;
CREATE TRIGGER on_guide_validity_date_set
AFTER INSERT OR UPDATE OF guide_validity_date ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.create_guide_expiry_task();