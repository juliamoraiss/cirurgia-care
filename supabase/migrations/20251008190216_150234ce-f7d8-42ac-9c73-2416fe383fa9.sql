-- Add username column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username TEXT UNIQUE;

-- Add index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Create a function to get email by username for authentication
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email
  FROM public.profiles
  WHERE username = _username
  LIMIT 1
$$;