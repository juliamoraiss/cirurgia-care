-- Add user_type column to profiles for doctor/dentist selection
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('medico', 'dentista'));