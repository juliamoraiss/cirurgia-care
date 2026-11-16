-- Permite registrar no Histórico do paciente as mensagens enviadas pelo app
-- (ex.: "Confirmação da cirurgia enviada ao paciente"). Cada usuário só grava
-- em seu próprio nome.
DROP POLICY IF EXISTS "Authenticated users can log patient events" ON public.patient_history;
CREATE POLICY "Authenticated users can log patient events"
  ON public.patient_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated_user() AND changed_by = auth.uid());
