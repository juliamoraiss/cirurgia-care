-- Fix traffic-reports storage bucket access control mismatch
-- The paid_traffic_reports table is admin-only, but storage was open to all authenticated users

-- Drop existing permissive storage policies for traffic-reports bucket
DROP POLICY IF EXISTS "Authenticated users can upload traffic reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view traffic reports" ON storage.objects;

-- Create admin-only storage policies to match table access control
CREATE POLICY "Only admins can upload traffic reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'traffic-reports' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Only admins can view traffic reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'traffic-reports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Only admins can update traffic reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'traffic-reports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Only admins can delete traffic reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'traffic-reports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);