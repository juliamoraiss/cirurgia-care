-- Remove o perfil "dentista" do fluxo de cadastro e das permissões.
-- O valor 'dentist' continua existindo no enum app_role (o Postgres não permite
-- remover valores de enum com facilidade), mas deixa de ser atribuído e aceito.

-- Todo novo cadastro recebe o perfil de médico
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign role if user doesn't already have one (new signup)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'doctor'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

-- Usuários autenticados válidos: apenas admin e médico
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'doctor'::app_role)
  )
$$;
