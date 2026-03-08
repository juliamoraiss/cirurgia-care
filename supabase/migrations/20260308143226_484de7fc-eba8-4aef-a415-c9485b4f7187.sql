
-- Drop existing policies
DROP POLICY IF EXISTS "Block anonymous access to schedule_blocks" ON public.schedule_blocks;
DROP POLICY IF EXISTS "Users can manage their own schedule_blocks" ON public.schedule_blocks;

-- Recreate: block anon (RESTRICTIVE)
CREATE POLICY "Block anonymous access to schedule_blocks"
  ON public.schedule_blocks AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Recreate: authenticated users can manage their own blocks (PERMISSIVE)
CREATE POLICY "Users can manage their own schedule_blocks"
  ON public.schedule_blocks FOR ALL TO authenticated
  USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
