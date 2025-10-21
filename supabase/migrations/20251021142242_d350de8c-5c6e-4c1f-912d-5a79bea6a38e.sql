-- Adicionar novo status "awaiting_consultation" ao enum patient_status
ALTER TYPE patient_status ADD VALUE IF NOT EXISTS 'awaiting_consultation';

-- Definir valor padrão 'sistema' para a coluna origem
ALTER TABLE public.patients ALTER COLUMN origem SET DEFAULT 'sistema';