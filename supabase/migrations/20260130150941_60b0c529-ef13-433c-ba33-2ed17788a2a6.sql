-- Drop the old constraint that only allows ios and android
ALTER TABLE public.user_push_tokens DROP CONSTRAINT user_push_tokens_platform_check;

-- Add new constraint that includes web platform
ALTER TABLE public.user_push_tokens ADD CONSTRAINT user_push_tokens_platform_check 
CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text]));