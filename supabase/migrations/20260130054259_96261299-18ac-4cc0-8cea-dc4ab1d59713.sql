-- Add oncology tracking fields to patients table
ALTER TABLE public.patients
ADD COLUMN is_oncology BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN oncology_stage TEXT,
ADD COLUMN oncology_notes TEXT;

-- Create oncology timeline events table
CREATE TABLE public.oncology_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oncology_timeline ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to oncology_timeline"
ON public.oncology_timeline
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Users can view timeline for their patients or admins view all
CREATE POLICY "Users can view oncology timeline for their patients or admins view all"
ON public.oncology_timeline
AS RESTRICTIVE
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Users can create timeline events for their patients or admins create all
CREATE POLICY "Users can create oncology timeline events"
ON public.oncology_timeline
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Users can update timeline events for their patients or admins update all
CREATE POLICY "Users can update oncology timeline events"
ON public.oncology_timeline
AS RESTRICTIVE
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM patients 
    WHERE patients.id = oncology_timeline.patient_id 
    AND patients.responsible_user_id = auth.uid()
  )
);

-- Only admins can delete timeline events
CREATE POLICY "Only admins can delete oncology timeline events"
ON public.oncology_timeline
AS RESTRICTIVE
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));