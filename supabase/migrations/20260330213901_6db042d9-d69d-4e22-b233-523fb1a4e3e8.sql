
CREATE OR REPLACE FUNCTION public.create_cannula_renewal_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_procedure TEXT;
BEGIN
  -- Only trigger when a cannula task is marked as completed
  IF NEW.completed = true AND OLD.completed = false 
     AND lower(NEW.title) LIKE '%cânula%' THEN
    
    -- Verify the patient still has a cannula procedure
    SELECT lower(procedure) INTO patient_procedure
    FROM public.patients
    WHERE id = NEW.patient_id;
    
    IF patient_procedure LIKE '%troca de c_nula%' THEN
      INSERT INTO public.patient_tasks (
        patient_id, task_type, title, description, due_date, created_by, completed
      ) VALUES (
        NEW.patient_id,
        'custom',
        'Troca de cânula - Lembrete de 3 meses',
        'Lembrete automático: agendar próxima troca de cânula. Ciclo contínuo a cada 3 meses.',
        now() + INTERVAL '3 months',
        COALESCE(auth.uid(), NEW.created_by),
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_cannula_renewal_on_complete
  AFTER UPDATE ON public.patient_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cannula_renewal_task();
