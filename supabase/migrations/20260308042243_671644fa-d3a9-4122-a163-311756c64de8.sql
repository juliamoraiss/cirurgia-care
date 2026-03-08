
-- Table for blocking specific dates or date ranges
CREATE TABLE public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to schedule_blocks"
  ON public.schedule_blocks AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Doctors can manage their own blocks
CREATE POLICY "Users can manage their own schedule_blocks"
  ON public.schedule_blocks AS RESTRICTIVE FOR ALL TO authenticated
  USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
