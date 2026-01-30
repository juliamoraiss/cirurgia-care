-- Create table to log user role changes for security auditing
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_before TEXT,
  role_after TEXT,
  action TEXT NOT NULL,
  changed_by uuid,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view role audit logs"
ON public.role_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Block anonymous access
CREATE POLICY "Block anonymous access to role_audit_log"
ON public.role_audit_log
FOR ALL
TO anon
USING (false);

-- Create trigger function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_audit_log (user_id, role_before, role_after, action, changed_by)
    VALUES (NEW.user_id, NULL, NEW.role::TEXT, 'INSERT', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.role_audit_log (user_id, role_before, role_after, action, changed_by)
    VALUES (NEW.user_id, OLD.role::TEXT, NEW.role::TEXT, 'UPDATE', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_log (user_id, role_before, role_after, action, changed_by)
    VALUES (OLD.user_id, OLD.role::TEXT, NULL, 'DELETE', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS audit_role_changes ON public.user_roles;
CREATE TRIGGER audit_role_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_changes();

-- Add comment explaining the security purpose
COMMENT ON TABLE public.role_audit_log IS 'Security audit log for all user role changes. Helps detect privilege escalation attempts.';