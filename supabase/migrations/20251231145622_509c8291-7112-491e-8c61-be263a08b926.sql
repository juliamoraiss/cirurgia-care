-- Block anonymous access to all sensitive tables
-- This adds explicit deny policies for the 'anon' role as defense-in-depth

-- Block anonymous access to patients table
CREATE POLICY "Block anonymous access to patients"
ON public.patients
FOR ALL
TO anon
USING (false);

-- Block anonymous access to profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- Block anonymous access to patient_files
CREATE POLICY "Block anonymous access to patient_files"
ON public.patient_files
FOR ALL
TO anon
USING (false);

-- Block anonymous access to system_activities
CREATE POLICY "Block anonymous access to system_activities"
ON public.system_activities
FOR ALL
TO anon
USING (false);

-- Block anonymous access to patient_feedbacks
CREATE POLICY "Block anonymous access to patient_feedbacks"
ON public.patient_feedbacks
FOR ALL
TO anon
USING (false);

-- Block anonymous access to paid_traffic_reports
CREATE POLICY "Block anonymous access to paid_traffic_reports"
ON public.paid_traffic_reports
FOR ALL
TO anon
USING (false);

-- Block anonymous access to patient_notes
CREATE POLICY "Block anonymous access to patient_notes"
ON public.patient_notes
FOR ALL
TO anon
USING (false);

-- Block anonymous access to patient_tasks
CREATE POLICY "Block anonymous access to patient_tasks"
ON public.patient_tasks
FOR ALL
TO anon
USING (false);

-- Block anonymous access to patient_history
CREATE POLICY "Block anonymous access to patient_history"
ON public.patient_history
FOR ALL
TO anon
USING (false);

-- Block anonymous access to user_roles
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);

-- Block anonymous access to user_push_tokens
CREATE POLICY "Block anonymous access to user_push_tokens"
ON public.user_push_tokens
FOR ALL
TO anon
USING (false);