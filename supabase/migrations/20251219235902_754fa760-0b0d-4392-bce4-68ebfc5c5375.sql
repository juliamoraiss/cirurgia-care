-- Create function to automatically create follow-up task after surgery completion
CREATE OR REPLACE FUNCTION public.create_surgery_followup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes TO 'surgery_completed'
  IF NEW.status = 'surgery_completed' AND (OLD.status IS NULL OR OLD.status != 'surgery_completed') THEN
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
      'Entrar em contato com o paciente para saber como está se sentindo após a cirurgia e coletar feedback sobre o procedimento realizado.',
      'followup',
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
        'task_type', 'followup'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire after patient status update
CREATE TRIGGER create_followup_on_surgery_completed
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_surgery_followup_task();