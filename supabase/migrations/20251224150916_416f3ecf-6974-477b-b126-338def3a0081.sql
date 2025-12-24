-- Update the log_file_upload function to show "Exame adicionado" instead of "Arquivo anexado"
CREATE OR REPLACE FUNCTION public.log_file_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_name_var TEXT;
BEGIN
  SELECT name INTO patient_name_var FROM public.patients WHERE id = NEW.patient_id;
  
  INSERT INTO public.system_activities (
    activity_type,
    description,
    patient_id,
    patient_name,
    created_by,
    metadata
  ) VALUES (
    'file_uploaded',
    'Exame adicionado',
    NEW.patient_id,
    patient_name_var,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object(
      'file_name', NEW.file_name,
      'file_type', NEW.file_type
    )
  );
  RETURN NEW;
END;
$$;