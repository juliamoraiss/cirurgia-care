-- Cirurgia "a confirmar": data proposta, aguardando confirmação do hospital/paciente.
-- Aparece na agenda com visual diferente das cirurgias confirmadas.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS surgery_to_confirm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patients.surgery_to_confirm IS
  'true quando a data da cirurgia é só uma proposta, ainda aguardando confirmação do hospital/paciente';
