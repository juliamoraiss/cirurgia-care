
CREATE TABLE public.chat_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  phone text,
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors to insert leads
CREATE POLICY "Anyone can submit a chat lead"
ON public.chat_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated users with roles can view leads
CREATE POLICY "Authenticated users can view chat leads"
ON public.chat_leads
FOR SELECT
TO authenticated
USING (is_authenticated_user());

-- Only admins can delete leads
CREATE POLICY "Only admins can delete chat leads"
ON public.chat_leads
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
