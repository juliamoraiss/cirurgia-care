-- Criar tabela de atividades do sistema
CREATE TABLE IF NOT EXISTS public.system_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Habilitar RLS
ALTER TABLE public.system_activities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view activities"
ON public.system_activities
FOR SELECT
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create activities"
ON public.system_activities
FOR INSERT
WITH CHECK (is_authenticated_user());

-- Índice para melhorar performance
CREATE INDEX idx_system_activities_created_at ON public.system_activities(created_at DESC);
CREATE INDEX idx_system_activities_patient_id ON public.system_activities(patient_id);

-- Função para registrar criação de paciente
CREATE OR REPLACE FUNCTION log_patient_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.system_activities (
    activity_type,
    description,
    patient_id,
    patient_name,
    created_by,
    metadata
  ) VALUES (
    'patient_created',
    'Novo paciente cadastrado',
    NEW.id,
    NEW.name,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object(
      'procedure', NEW.procedure,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger para criação de paciente
CREATE TRIGGER trigger_log_patient_creation
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION log_patient_creation();

-- Função para registrar agendamento de cirurgia
CREATE OR REPLACE FUNCTION log_surgery_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.surgery_date IS NULL AND NEW.surgery_date IS NOT NULL THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'surgery_scheduled',
      'Cirurgia agendada',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'surgery_date', NEW.surgery_date,
        'hospital', NEW.hospital,
        'procedure', NEW.procedure
      )
    );
  ELSIF OLD.surgery_date IS NOT NULL AND NEW.surgery_date IS NOT NULL AND OLD.surgery_date != NEW.surgery_date THEN
    INSERT INTO public.system_activities (
      activity_type,
      description,
      patient_id,
      patient_name,
      created_by,
      metadata
    ) VALUES (
      'surgery_rescheduled',
      'Cirurgia reagendada',
      NEW.id,
      NEW.name,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_surgery_date', OLD.surgery_date,
        'new_surgery_date', NEW.surgery_date,
        'hospital', NEW.hospital
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para agendamento de cirurgia
CREATE TRIGGER trigger_log_surgery_schedule
AFTER UPDATE ON public.patients
FOR EACH ROW
WHEN (OLD.surgery_date IS DISTINCT FROM NEW.surgery_date)
EXECUTE FUNCTION log_surgery_schedule();

-- Função para registrar upload de arquivo
CREATE OR REPLACE FUNCTION log_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    'Arquivo anexado',
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

-- Trigger para upload de arquivo
CREATE TRIGGER trigger_log_file_upload
AFTER INSERT ON public.patient_files
FOR EACH ROW
EXECUTE FUNCTION log_file_upload();

-- Função para registrar criação de nota
CREATE OR REPLACE FUNCTION log_note_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    'note_created',
    'Nova anotação adicionada',
    NEW.patient_id,
    patient_name_var,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object(
      'note_preview', LEFT(NEW.note, 100)
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger para criação de nota
CREATE TRIGGER trigger_log_note_creation
AFTER INSERT ON public.patient_notes
FOR EACH ROW
EXECUTE FUNCTION log_note_creation();

-- Função para registrar criação de tarefa
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    'task_created',
    'Nova tarefa criada',
    NEW.patient_id,
    patient_name_var,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object(
      'task_title', NEW.title,
      'task_type', NEW.task_type
    )
  );
  RETURN NEW;
END;
$$;

-- Trigger para criação de tarefa
CREATE TRIGGER trigger_log_task_creation
AFTER INSERT ON public.patient_tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_creation();