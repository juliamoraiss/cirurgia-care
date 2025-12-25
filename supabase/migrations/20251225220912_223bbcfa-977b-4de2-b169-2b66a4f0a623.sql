-- Update the create_surgery_followup_task function to use correct task_type
CREATE OR REPLACE FUNCTION public.create_surgery_followup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes TO 'completed' (cirurgia realizada)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
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
      'Acompanhamento pós-cirurgia - 30 dias',
      'Enviar mensagem de follow-up para saber como o paciente está se sentindo desde a cirurgia e como está sendo a recuperação. Coletar feedback sobre a experiência.',
      'post_op_30_days',
      COALESCE(NEW.surgery_date, now()) + INTERVAL '30 days',
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
    
    -- Log the activity
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'followup_task_created',
      'Tarefa de acompanhamento pós-cirurgia criada automaticamente',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'due_date', (COALESCE(NEW.surgery_date, now()) + INTERVAL '30 days')::text,
        'task_type', 'post_op_30_days'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_surgery_completed ON public.patients;
CREATE TRIGGER on_surgery_completed
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_surgery_followup_task();