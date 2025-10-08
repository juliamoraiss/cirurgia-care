-- Enhanced create_user_with_username function with admin check and input validation
CREATE OR REPLACE FUNCTION public.create_user_with_username(_username text, _password text, _full_name text DEFAULT NULL::text)
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
  -- Check if caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Apenas administradores podem criar usuários'
    );
  END IF;

  -- Input validation: username must be 3-50 characters, alphanumeric and underscores only
  IF _username IS NULL OR LENGTH(_username) < 3 OR LENGTH(_username) > 50 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nome de usuário deve ter entre 3 e 50 caracteres'
    );
  END IF;

  IF _username !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nome de usuário deve conter apenas letras, números e underscore'
    );
  END IF;

  -- Password validation: minimum 8 characters
  IF _password IS NULL OR LENGTH(_password) < 8 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Senha deve ter no mínimo 8 caracteres'
    );
  END IF;

  -- Generate a unique email based on username
  generated_email := _username || '@sistema.local';

  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nome de usuário já existe'
    );
  END IF;

  -- Create the user in auth.users using pgcrypto
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
    extensions.crypt(_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', COALESCE(_full_name, _username)),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Update profile with username
  UPDATE public.profiles
  SET username = _username
  WHERE id = new_user_id;

  -- Return result
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

-- Fix search_path for get_email_by_username function
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE username = _username
  LIMIT 1
$$;