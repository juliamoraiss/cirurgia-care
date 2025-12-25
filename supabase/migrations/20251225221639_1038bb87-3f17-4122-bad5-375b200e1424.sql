-- Drop the existing check constraint and add a new one with all task types
ALTER TABLE public.patient_tasks DROP CONSTRAINT IF EXISTS patient_tasks_task_type_check;

ALTER TABLE public.patient_tasks ADD CONSTRAINT patient_tasks_task_type_check 
CHECK (task_type IN ('exam_followup', 'pre_op_instructions', 'post_op_instructions', 'post_op_30_days', 'guide_expiry_reminder', 'custom'));