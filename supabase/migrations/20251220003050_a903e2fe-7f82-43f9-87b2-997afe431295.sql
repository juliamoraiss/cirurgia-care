-- Create a table for patient feedbacks (screenshots of messages)
CREATE TABLE public.patient_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, -- 'pre_op', 'post_op', 'post_op_30_days', 'exam_followup', 'other'
  description TEXT,
  image_path TEXT NOT NULL,
  image_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.patient_feedbacks ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Authenticated users can view feedbacks"
ON public.patient_feedbacks
FOR SELECT
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create feedbacks"
ON public.patient_feedbacks
FOR INSERT
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete feedbacks"
ON public.patient_feedbacks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for feedback images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-feedbacks', 'patient-feedbacks', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback images
CREATE POLICY "Authenticated users can view feedback images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'patient-feedbacks' AND is_authenticated_user());

CREATE POLICY "Authenticated users can upload feedback images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'patient-feedbacks' AND is_authenticated_user());

CREATE POLICY "Admins can delete feedback images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'patient-feedbacks' AND has_role(auth.uid(), 'admin'::app_role));