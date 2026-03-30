-- Fix: The "Block anonymous access" policy is RESTRICTIVE, which blocks ALL queries
-- (including admin). Need to make it PERMISSIVE so it only affects anon role.
-- Also need to make the other policies PERMISSIVE.

-- Drop all existing policies
DROP POLICY IF EXISTS "Block anonymous access to google_calendar_connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Admins can view all calendar connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can view their own calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connection" ON public.google_calendar_connections;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Block anonymous access to google_calendar_connections"
  ON public.google_calendar_connections
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Users can view their own calendar connection"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all calendar connections"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own calendar connection"
  ON public.google_calendar_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connection"
  ON public.google_calendar_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connection"
  ON public.google_calendar_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);