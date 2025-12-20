-- Drop existing SELECT policy on patients table
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;

-- Create new policy requiring authentication (using auth.role() check)
CREATE POLICY "Authenticated users can view patients" 
ON public.patients 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_authenticated_user());

-- Also fix profiles table (from previous finding)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy requiring authentication for profiles
CREATE POLICY "Authenticated users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.role() = 'authenticated' AND auth.uid() = id);