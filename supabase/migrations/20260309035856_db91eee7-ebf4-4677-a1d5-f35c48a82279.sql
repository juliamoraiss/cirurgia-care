-- Drop old check constraint and recreate with the new task types
ALTER TABLE public.patient_tasks 
  DROP CONSTRAINT patient_tasks_task_type_check;

ALTER TABLE public.patient_tasks 
  ADD CONSTRAINT patient_tasks_task_type_check 
  CHECK (task_type = ANY (ARRAY[
    'exam_followup'::text,
    'pre_op_instructions'::text,
    'post_op_instructions'::text,
    'post_op_30_days'::text,
    'guide_expiry_reminder'::text,
    'custom'::text,
    'surgery_confirmation_patient'::text,
    'surgery_confirmation_doctor'::text
  ]));