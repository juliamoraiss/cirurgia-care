-- Remove the foreign key constraint on patient_history.changed_by
-- so that system/automated changes can be logged with a system UUID
ALTER TABLE public.patient_history
DROP CONSTRAINT IF EXISTS patient_history_changed_by_fkey;

-- Re-run the edge function to update past surgeries
SELECT
  net.http_post(
      url:='https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/update-completed-surgeries',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;