-- Notificação no celular na hora de cada tarefa.
-- A função send-task-notifications roda a cada 5 minutos, envia push para as
-- tarefas que venceram e ainda não foram notificadas, e marca notified_at.

ALTER TABLE public.patient_tasks
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Não notificar o que já passou ou já foi concluído antes desta mudança
UPDATE public.patient_tasks
SET notified_at = now()
WHERE notified_at IS NULL
  AND (completed OR due_date <= now());

-- Se a data/hora da tarefa mudar (reagendamento), notifica de novo no novo horário
CREATE OR REPLACE FUNCTION public.reset_task_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.due_date > now() THEN
    NEW.notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_task_notification_on_due_change ON public.patient_tasks;
CREATE TRIGGER reset_task_notification_on_due_change
  BEFORE UPDATE OF due_date ON public.patient_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_task_notification();

CREATE INDEX IF NOT EXISTS idx_patient_tasks_pending_notification
  ON public.patient_tasks (due_date)
  WHERE notified_at IS NULL AND completed = false;

-- Agenda a verificação a cada 5 minutos (mesmo padrão dos outros jobs: anon key)
DO $$
BEGIN
  PERFORM cron.unschedule('send-task-notifications');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ainda não existia
END;
$$;

SELECT cron.schedule(
  'send-task-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/send-task-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
