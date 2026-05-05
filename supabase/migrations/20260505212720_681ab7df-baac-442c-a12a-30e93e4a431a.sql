CREATE TABLE IF NOT EXISTS public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hospitals_name_normalized_unique
  ON public.hospitals (name_normalized);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to hospitals"
  ON public.hospitals
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Authenticated users can view hospitals"
  ON public.hospitals
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_user());

CREATE POLICY "Authenticated users can insert hospitals"
  ON public.hospitals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated_user() AND created_by = auth.uid());

CREATE POLICY "Admins can update hospitals"
  ON public.hospitals
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hospitals"
  ON public.hospitals
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.normalize_hospital_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.name_normalized := lower(trim(regexp_replace(
    translate(
      COALESCE(NEW.name, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ),
    '\s+', ' ', 'g'
  )));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hospitals_normalize_name ON public.hospitals;
CREATE TRIGGER hospitals_normalize_name
  BEFORE INSERT OR UPDATE ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_hospital_name();

INSERT INTO public.hospitals (name, name_normalized, created_by)
SELECT DISTINCT trim(h), ''::text, NULL::uuid
FROM (
  VALUES
    ('Hospital Brasília'),
    ('Hospital Anchieta'),
    ('Hospital Prontonorte'),
    ('Hospital Santa Lúcia Norte'),
    ('Hospital Mantevida'),
    ('Hospital Ceuta'),
    ('Hospital Alvorada'),
    ('Hospital DF Star')
) AS canonical(h)
ON CONFLICT (name_normalized) DO NOTHING;

INSERT INTO public.hospitals (name, name_normalized, created_by)
SELECT DISTINCT trim(p.hospital), ''::text, NULL::uuid
FROM public.patients p
WHERE p.hospital IS NOT NULL AND trim(p.hospital) <> ''
ON CONFLICT (name_normalized) DO NOTHING;
