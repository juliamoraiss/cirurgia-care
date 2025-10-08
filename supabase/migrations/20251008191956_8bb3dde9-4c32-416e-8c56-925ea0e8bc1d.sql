-- Função para criar novo usuário com username e senha
CREATE OR REPLACE FUNCTION public.create_user_with_username(
  _username text,
  _password text,
  _full_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_email text;
  new_user_id uuid;
  result json;
BEGIN
  -- Gera um email único baseado no username
  generated_email := _username || '@sistema.local';
  
  -- Verifica se o username já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
    RAISE EXCEPTION 'Username já existe';
  END IF;
  
  -- Cria o usuário no auth.users (usando extensão pgsodium para criptografar a senha)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    generated_email,
    crypt(_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', COALESCE(_full_name, _username)),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;
  
  -- Atualiza o perfil com o username
  UPDATE public.profiles
  SET username = _username
  WHERE id = new_user_id;
  
  -- Retorna informações do usuário criado
  SELECT json_build_object(
    'success', true,
    'user_id', new_user_id,
    'username', _username,
    'email', generated_email
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;