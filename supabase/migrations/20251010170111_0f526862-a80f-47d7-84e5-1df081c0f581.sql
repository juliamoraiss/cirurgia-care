-- Remove the existing cron job
SELECT cron.unschedule('update-completed-surgeries');

-- Create a new cron job to run every 5 minutes
SELECT cron.schedule(
  'update-completed-surgeries',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/update-completed-surgeries',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Execute the function immediately to update existing past surgeries
SELECT
  net.http_post(
      url:='https://yzvqgzjclmrtndvpqzgk.supabase.co/functions/v1/update-completed-surgeries',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dnFnempjbG1ydG5kdnBxemdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzY5MDQsImV4cCI6MjA3NDkxMjkwNH0.LznFb6w_UiDIkB83RXN9JUpM8G1hFV2IIcMty8dnBPg"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;