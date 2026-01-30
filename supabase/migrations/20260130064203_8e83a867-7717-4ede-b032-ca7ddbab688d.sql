-- Drop existing permissive policies for paid_traffic_reports
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.paid_traffic_reports;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON public.paid_traffic_reports;
DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.paid_traffic_reports;

-- Create admin-only policies for paid_traffic_reports
CREATE POLICY "Only admins can create reports" 
ON public.paid_traffic_reports 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update reports" 
ON public.paid_traffic_reports 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can view reports" 
ON public.paid_traffic_reports 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));