-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the edge function to run every hour to update completed surgeries
SELECT cron.schedule(
  'update-completed-surgeries',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/update-completed-surgeries',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);