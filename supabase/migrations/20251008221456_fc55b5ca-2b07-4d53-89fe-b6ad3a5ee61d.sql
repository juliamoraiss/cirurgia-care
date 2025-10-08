-- Criar tabela de tarefas/lembretes para pacientes
CREATE TABLE public.patient_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('exam_followup', 'pre_op_instructions', 'post_op_instructions', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de notas/interações com pacientes
CREATE TABLE public.patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.patient_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para patient_tasks
CREATE POLICY "Authenticated users can view tasks"
ON public.patient_tasks
FOR SELECT
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create tasks"
ON public.patient_tasks
FOR INSERT
TO authenticated
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update tasks"
ON public.patient_tasks
FOR UPDATE
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Only admins can delete tasks"
ON public.patient_tasks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para patient_notes
CREATE POLICY "Authenticated users can view notes"
ON public.patient_notes
FOR SELECT
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can create notes"
ON public.patient_notes
FOR INSERT
TO authenticated
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update notes"
ON public.patient_notes
FOR UPDATE
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Only admins can delete notes"
ON public.patient_notes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices para melhorar performance
CREATE INDEX idx_patient_tasks_patient_id ON public.patient_tasks(patient_id);
CREATE INDEX idx_patient_tasks_due_date ON public.patient_tasks(due_date);
CREATE INDEX idx_patient_tasks_completed ON public.patient_tasks(completed);
CREATE INDEX idx_patient_notes_patient_id ON public.patient_notes(patient_id);

-- Trigger para atualizar updated_at nas novas tabelas
CREATE TRIGGER update_patient_tasks_updated_at
BEFORE UPDATE ON public.patient_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_notes_updated_at
BEFORE UPDATE ON public.patient_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();