
CREATE TABLE public.patient_surgeries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  procedure text NOT NULL,
  hospital text,
  surgery_date timestamp with time zone,
  status patient_status NOT NULL DEFAULT 'completed',
  notes text,
  responsible_user_id uuid REFERENCES auth.users(id),
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_surgeries_patient ON public.patient_surgeries(patient_id);
CREATE INDEX idx_patient_surgeries_date ON public.patient_surgeries(surgery_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_surgeries TO authenticated;
GRANT ALL ON public.patient_surgeries TO service_role;

ALTER TABLE public.patient_surgeries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon access to patient_surgeries"
  ON public.patient_surgeries
  TO anon
  USING (false);

CREATE POLICY "View surgeries of own patients or admin"
  ON public.patient_surgeries FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_surgeries.patient_id
        AND p.responsible_user_id = auth.uid()
    )
  );

CREATE POLICY "Insert surgeries for own patients or admin"
  ON public.patient_surgeries FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_surgeries.patient_id
        AND p.responsible_user_id = auth.uid()
    )
  );

CREATE POLICY "Update surgeries of own patients or admin"
  ON public.patient_surgeries FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_surgeries.patient_id
        AND p.responsible_user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can delete patient_surgeries"
  ON public.patient_surgeries FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_patient_surgeries_updated_at
  BEFORE UPDATE ON public.patient_surgeries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
