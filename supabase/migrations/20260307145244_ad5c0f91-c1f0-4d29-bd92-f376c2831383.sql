
-- Drop restrictive policies
DROP POLICY "Block anonymous access to surgery_availability" ON public.surgery_availability;
DROP POLICY "Users can view their own availability" ON public.surgery_availability;
DROP POLICY "Users can insert their own availability" ON public.surgery_availability;
DROP POLICY "Users can update their own availability" ON public.surgery_availability;
DROP POLICY "Users can delete their own availability" ON public.surgery_availability;

-- Recreate as permissive + one restrictive for anon block
CREATE POLICY "Block anonymous access to surgery_availability"
  ON public.surgery_availability AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Users can view their own availability"
  ON public.surgery_availability FOR SELECT TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own availability"
  ON public.surgery_availability FOR INSERT TO authenticated
  WITH CHECK (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own availability"
  ON public.surgery_availability FOR UPDATE TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own availability"
  ON public.surgery_availability FOR DELETE TO authenticated
  USING (doctor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
