DROP POLICY IF EXISTS "Anonymous users can submit a chat lead" ON public.chat_leads;
CREATE POLICY "Anonymous users can submit a valid chat lead"
ON public.chat_leads FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 100
  AND phone IS NOT NULL AND length(btrim(phone)) BETWEEN 8 AND 20 AND phone ~ '^[0-9()+\-\s]+$'
  AND (message IS NULL OR length(message) <= 1000)
);