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
  -- Skip pre/post-op task creation entirely for WhatsApp-imported patients
  IF NEW.origem = 'whatsapp' THEN
    RETURN NEW;
  END IF;

  -- If surgery_date is REMOVED (set to null), complete related pending tasks
  IF OLD.surgery_date IS NOT NULL AND NEW.surgery_date IS NULL THEN
    UPDATE public.patient_tasks
    SET completed = true,
        completed_at = now(),
        completed_by = auth.uid(),
        updated_at = now()
    WHERE patient_id = NEW.id
      AND task_type IN ('pre_op_instructions', 'post_op_instructions', 'surgery_confirmation_patient', 'surgery_confirmation_doctor')
      AND completed = false;

    RETURN NEW;
  END IF;

  IF NEW.surgery_date IS NOT NULL AND (OLD.surgery_date IS NULL OR OLD.surgery_date != NEW.surgery_date) THEN
    pre_op_due := (NEW.surgery_date - INTERVAL '1 day')::date::timestamp with time zone;
    IF pre_op_due < now() THEN
      pre_op_due := now();
    END IF;

    post_op_due := NEW.surgery_date + INTERVAL '5 hours';

    UPDATE public.patient_tasks
    SET completed = true,
        completed_at = now(),
        completed_by = auth.uid(),
        updated_at = now()
    WHERE patient_id = NEW.id
      AND task_type IN ('pre_op_instructions', 'post_op_instructions', 'surgery_confirmation_patient', 'surgery_confirmation_doctor')
      AND completed = false;

    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'pre_op_instructions',
      'Enviar instruções pré-operatórias',
      'Enviar instruções ao paciente ' || NEW.name || ' para a cirurgia de ' || NEW.procedure,
      pre_op_due, COALESCE(auth.uid(), NEW.created_by), false
    );

    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'post_op_instructions',
      'Enviar recomendações pós-operatórias',
      'Enviar recomendações ao paciente ' || NEW.name || ' após a cirurgia de ' || NEW.procedure,
      post_op_due, COALESCE(auth.uid(), NEW.created_by), false
    );

    INSERT INTO public.patient_tasks (patient_id, task_type, title, description, due_date, created_by, completed)
    VALUES (
      NEW.id, 'surgery_confirmation_patient',
      'Enviar confirmação da cirurgia ao paciente',
      'Confirmar agendamento da cirurgia de ' || NEW.procedure || ' com o paciente ' || NEW.name || ' no hospital ' || COALESCE(NEW.hospital, 'não definido'),
      now(), COALESCE(auth.uid(), NEW.created_by), false
    );

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