
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
    IF pre_op_due < now() THEN
      pre_op_due := now();
    END IF;
    
    -- Calculate post-op due date: 5 hours after surgery
    post_op_due := NEW.surgery_date + INTERVAL '5 hours';
    
    -- Delete existing incomplete tasks to avoid duplicates on reschedule
    DELETE FROM public.patient_tasks 
    WHERE patient_id = NEW.id 
      AND task_type IN ('pre_op_instructions', 'post_op_instructions', 'surgery_confirmation_patient', 'surgery_confirmation_doctor')
      AND completed = false;
    
    -- Create pre-op instructions task
    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'pre_op_instructions',
      'Enviar instruções pré-operatórias',
      'Enviar instruções ao paciente ' || NEW.name || ' para a cirurgia de ' || NEW.procedure,
      pre_op_due, COALESCE(auth.uid(), NEW.created_by), false
    );
    
    -- Create post-op instructions task
    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'post_op_instructions',
      'Enviar recomendações pós-operatórias',
      'Enviar recomendações ao paciente ' || NEW.name || ' após a cirurgia de ' || NEW.procedure,
      post_op_due, COALESCE(auth.uid(), NEW.created_by), false
    );
    
    -- Create surgery confirmation to patient task (due immediately)
    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'surgery_confirmation_patient',
      'Enviar confirmação da cirurgia ao paciente',
      'Confirmar agendamento da cirurgia de ' || NEW.procedure || ' com o paciente ' || NEW.name || ' no hospital ' || COALESCE(NEW.hospital, 'não definido'),
      now(), COALESCE(auth.uid(), NEW.created_by), false
    );
    
    -- Create surgery confirmation to doctor task (due immediately)
    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'surgery_confirmation_doctor',
      'Notificar médico sobre cirurgia agendada',
      'Informar o médico responsável sobre o agendamento da cirurgia de ' || NEW.procedure || ' do paciente ' || NEW.name,
      now(), COALESCE(auth.uid(), NEW.created_by), false
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;
