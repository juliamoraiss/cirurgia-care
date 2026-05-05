-- Habilita pg_trgm para similaridade de strings
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Trigger BEFORE INSERT que bloqueia hospitais com nome muito parecido
CREATE OR REPLACE FUNCTION public.prevent_duplicate_hospital()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  similar_name text;
  similar_score real;
  threshold real := 0.75;
BEGIN
  -- Garante normalização (caso trigger de normalização não tenha rodado ainda)
  IF NEW.name_normalized IS NULL OR NEW.name_normalized = '' THEN
    NEW.name_normalized := lower(trim(regexp_replace(
      translate(
        COALESCE(NEW.name, ''),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      ),
      '\s+', ' ', 'g'
    )));
  END IF;

  -- 1) Match exato pelo normalizado
  SELECT name INTO similar_name
  FROM public.hospitals
  WHERE name_normalized = NEW.name_normalized
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF similar_name IS NOT NULL THEN
    RAISE EXCEPTION 'HOSPITAL_DUPLICATE: Já existe um hospital cadastrado com este nome: "%". Use o existente para evitar duplicidade.', similar_name
      USING ERRCODE = 'P0001';
  END IF;

  -- 2) Match aproximado via pg_trgm (typos, abreviações)
  SELECT name, similarity(name_normalized, NEW.name_normalized) AS score
    INTO similar_name, similar_score
  FROM public.hospitals
  WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND similarity(name_normalized, NEW.name_normalized) >= threshold
  ORDER BY score DESC
  LIMIT 1;

  IF similar_name IS NOT NULL THEN
    RAISE EXCEPTION 'HOSPITAL_SIMILAR: Já existe um hospital com nome muito parecido: "%". Para evitar duplicidade, prefira usar o existente.', similar_name
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Aplica o trigger antes do INSERT (depois do trigger de normalização já existente)
DROP TRIGGER IF EXISTS prevent_duplicate_hospital_trigger ON public.hospitals;
CREATE TRIGGER prevent_duplicate_hospital_trigger
BEFORE INSERT ON public.hospitals
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_hospital();