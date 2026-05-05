-- Normalize helper: lowercase + strip accents
CREATE OR REPLACE FUNCTION public.normalize_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(regexp_replace(
    translate(
      COALESCE(_name, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ),
    '\s+', ' ', 'g'
  )))
$$;

-- Collision check trigger
CREATE OR REPLACE FUNCTION public.check_surgery_collision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_record RECORD;
  threshold INTERVAL := INTERVAL '2 hours';
BEGIN
  -- Only check when surgery_date is set and changed
  IF NEW.surgery_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.surgery_date IS NOT DISTINCT FROM NEW.surgery_date
     AND public.normalize_name(OLD.name) = public.normalize_name(NEW.name) THEN
    RETURN NEW;
  END IF;

  SELECT id, name, surgery_date, procedure
    INTO conflict_record
  FROM public.patients
  WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND surgery_date IS NOT NULL
    AND public.normalize_name(name) = public.normalize_name(NEW.name)
    AND ABS(EXTRACT(EPOCH FROM (surgery_date - NEW.surgery_date))) < EXTRACT(EPOCH FROM threshold)
  LIMIT 1;

  IF conflict_record.id IS NOT NULL THEN
    RAISE EXCEPTION 'SURGERY_COLLISION: Já existe uma cirurgia para % em % (procedimento: %). Conflito com janela de 2h.',
      conflict_record.name,
      to_char(conflict_record.surgery_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      COALESCE(conflict_record.procedure, 'não definido')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_surgery_collision ON public.patients;
CREATE TRIGGER trg_check_surgery_collision
BEFORE INSERT OR UPDATE OF surgery_date, name ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.check_surgery_collision();