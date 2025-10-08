-- Ensure pgcrypto is available in the correct schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate function using fully qualified pgcrypto functions
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
  -- Generate a unique email based on username
  generated_email := _username || '@sistema.local';

  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
    RAISE EXCEPTION 'Username já existe';
  END IF;

  -- Create the user in auth.users using pgcrypto (schema-qualified)
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