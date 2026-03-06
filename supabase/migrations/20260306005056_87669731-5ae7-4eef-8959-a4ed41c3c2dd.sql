
-- Table to store Google Calendar OAuth tokens per user
CREATE TABLE public.google_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_timezone TEXT DEFAULT 'America/Sao_Paulo',
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to google_calendar_connections"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Users can view their own connection
CREATE POLICY "Users can view their own calendar connection"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own connection
CREATE POLICY "Users can insert their own calendar connection"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update their own calendar connection"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own connection
CREATE POLICY "Users can delete their own calendar connection"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all connections
CREATE POLICY "Admins can view all calendar connections"
ON public.google_calendar_connections
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
