-- Create paid traffic reports table
CREATE TABLE public.paid_traffic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  platform TEXT NOT NULL,
  investment DECIMAL(10,2),
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  cpc DECIMAL(10,2),
  cpa DECIMAL(10,2),
  roi DECIMAL(10,2),
  pdf_file_path TEXT,
  pdf_file_name TEXT,
  raw_data JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paid_traffic_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view reports"
ON public.paid_traffic_reports
FOR SELECT
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create reports"
ON public.paid_traffic_reports
FOR INSERT
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update reports"
ON public.paid_traffic_reports
FOR UPDATE
USING (is_authenticated_user());

CREATE POLICY "Only admins can delete reports"
ON public.paid_traffic_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_paid_traffic_reports_updated_at
BEFORE UPDATE ON public.paid_traffic_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for traffic reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('traffic-reports', 'traffic-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload traffic reports"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'traffic-reports' AND is_authenticated_user());

CREATE POLICY "Authenticated users can view traffic reports"
ON storage.objects
FOR SELECT
USING (bucket_id = 'traffic-reports' AND is_authenticated_user());

CREATE POLICY "Admins can delete traffic reports"
ON storage.objects
FOR DELETE
USING (bucket_id = 'traffic-reports' AND has_role(auth.uid(), 'admin'::app_role));