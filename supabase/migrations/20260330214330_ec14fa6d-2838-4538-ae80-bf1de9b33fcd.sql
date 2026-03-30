
-- Add cannula_reminder to the check constraint
ALTER TABLE public.patient_tasks DROP CONSTRAINT patient_tasks_task_type_check;
ALTER TABLE public.patient_tasks ADD CONSTRAINT patient_tasks_task_type_check 
  CHECK (task_type = ANY (ARRAY['exam_followup','pre_op_instructions','post_op_instructions','post_op_30_days','guide_expiry_reminder','custom','surgery_confirmation_patient','surgery_confirmation_doctor','cannula_reminder']));

-- Now update existing cannula tasks
UPDATE public.patient_tasks 
SET task_type = 'cannula_reminder' 
WHERE task_type = 'custom' AND lower(title) LIKE '%cânula%';

-- Update triggers to use cannula_reminder
CREATE OR REPLACE FUNCTION public.create_cannula_replacement_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND lower(NEW.procedure) LIKE '%troca de c_nula%' THEN
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'cannula_reminder',
      'Troca de cânula - Lembrete de 3 meses',
      'Lembrete automático: agendar troca de cânula do paciente ' || NEW.name || '.',
      now() + INTERVAL '3 months',
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_cannula_post_surgery_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND lower(NEW.procedure) LIKE '%troca de c_nula%' THEN
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'cannula_reminder',
      'Troca de cânula - Lembrete de 3 meses',
      'Lembrete automático: agendar próxima troca de cânula do paciente ' || NEW.name || '. Ciclo contínuo a cada 3 meses após cirurgia.',
      COALESCE(NEW.surgery_date, now()) + INTERVAL '3 months',
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
  END IF;
  RETURN NEW;
END;
$function$;
