
CREATE OR REPLACE FUNCTION public.create_cannula_replacement_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- On INSERT: if procedure contains 'troca de cânula', create a 3-month reminder
  IF TG_OP = 'INSERT' AND lower(NEW.procedure) LIKE '%troca de c_nula%' THEN
    INSERT INTO public.patient_tasks (
      patient_id, task_type, title, description, due_date, created_by, completed
    ) VALUES (
      NEW.id,
      'custom',
      'Troca de cânula - Lembrete de 3 meses',
      'Lembrete automático: agendar troca de cânula do paciente ' || NEW.name || '. Procedimento original realizado há 3 meses.',
      now() + INTERVAL '3 months',
      COALESCE(auth.uid(), NEW.created_by),
      false
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_create_cannula_replacement_task
  AFTER INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cannula_replacement_task();
