
-- Surgery availability: doctor's weekly schedule configuration
CREATE TABLE public.surgery_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  day_of_week integer NOT NULL, -- 0=Sunday, 6=Saturday
  start_time time NOT NULL,
  end_time time NOT NULL,
  default_duration_minutes integer NOT NULL DEFAULT 120,
  max_surgeries_per_day integer NOT NULL DEFAULT 3,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, day_of_week, start_time)
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_surgery_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.day_of_week < 0 OR NEW.day_of_week > 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 and 6';
  END IF;
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'start_time must be before end_time';
  END IF;
  IF NEW.default_duration_minutes < 15 OR NEW.default_duration_minutes > 720 THEN
    RAISE EXCEPTION 'default_duration_minutes must be between 15 and 720';
  END IF;
  IF NEW.max_surgeries_per_day < 1 OR NEW.max_surgeries_per_day > 20 THEN
    RAISE EXCEPTION 'max_surgeries_per_day must be between 1 and 20';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_surgery_availability
  BEFORE INSERT OR UPDATE ON public.surgery_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_surgery_availability();

-- Updated_at trigger
CREATE TRIGGER trg_surgery_availability_updated_at
  BEFORE UPDATE ON public.surgery_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.surgery_availability ENABLE ROW LEVEL SECURITY;

-- Block anonymous
CREATE POLICY "Block anonymous access to surgery_availability"
  ON public.surgery_availability AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Doctors can manage their own availability
CREATE POLICY "Users can view their own availability"
  ON public.surgery_availability AS RESTRICTIVE FOR SELECT TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own availability"
  ON public.surgery_availability AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own availability"
  ON public.surgery_availability AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own availability"
  ON public.surgery_availability AS RESTRICTIVE FOR DELETE TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
