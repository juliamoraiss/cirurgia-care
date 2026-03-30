
-- Remove the old trigger that fired on task completion
DROP TRIGGER IF EXISTS trigger_cannula_renewal_on_complete ON public.patient_tasks;
DROP FUNCTION IF EXISTS public.create_cannula_renewal_task();

-- Create new function that fires when cannula patient surgery is completed
CREATE OR REPLACE FUNCTION public.create_cannula_post_surgery_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when status changes TO 'completed' for cannula patients
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND lower(NEW.procedure) LIKE '%troca de c_nula%' THEN
    
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'custom',
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

CREATE TRIGGER trigger_cannula_post_surgery_renewal
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cannula_post_surgery_task();
