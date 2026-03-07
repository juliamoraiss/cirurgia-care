

## Link Público para Agendamento de Cirurgia pelo Paciente

### Visão Geral

O médico gera um link único para cada paciente. O paciente abre o link (sem login), vê os horários disponíveis e escolhe um. O sistema agenda automaticamente e notifica o médico.

### Arquitetura

```text
Médico (interno)                     Paciente (público)
─────────────────                    ──────────────────
PatientForm.tsx                      /schedule/:token
  └─ Botão "Gerar link"             PublicSchedule.tsx
       │                                  │
       ▼                                  ▼
scheduling_links (DB)               Edge Function: public-schedule
  - token (único)                     - Valida token
  - patient_id                        - Busca availability
  - doctor_id                         - Busca cirurgias existentes
  - expires_at                        - Retorna slots livres
  - used_at (null = ativo)            - Confirma agendamento
```

### Etapas de Implementação

**1. Nova tabela `scheduling_links`**
- `id`, `token` (text unique), `patient_id` (uuid), `doctor_id` (uuid), `expires_at` (timestamptz), `used_at` (timestamptz nullable), `created_at`
- RLS: médicos veem/criam links dos seus pacientes, admins veem todos, anon bloqueado
- O acesso público será feito via Edge Function (service role), não via RLS anon

**2. Edge Function `public-schedule`**
- `verify_jwt = false` (acesso público)
- Endpoints (via body action):
  - `get_slots`: recebe `token`, valida expiração/uso, busca `surgery_availability` do doctor, busca cirurgias já agendadas no dia, retorna slots livres para os próximos 30 dias
  - `confirm`: recebe `token` + `slot` (datetime), atualiza `patients.surgery_date`, marca `scheduling_links.used_at`, dispara criação de evento no Google Calendar
- Validações: token expirado, já utilizado, slot já ocupado

**3. Página pública `PublicSchedule.tsx`**
- Rota `/schedule/:token` (fora do ProtectedRoute)
- Layout limpo sem navegação do sistema
- Mostra: nome do paciente, procedimento, calendário mensal com dias que têm slots
- Ao clicar num dia: mostra horários disponíveis
- Ao confirmar: tela de sucesso com data/hora confirmada
- Estados: carregando, link expirado, link já usado, erro

**4. Botão "Gerar link" no PatientForm**
- Aparece apenas para pacientes com status `pending_scheduling` ou `authorized`
- Gera token aleatório, insere na tabela, exibe link copiável
- Link formato: `https://medsystem.lovable.app/schedule/{token}`

**5. Rota no App.tsx**
- Adicionar `/schedule/:token` como rota pública (sem ProtectedRoute)

### Segurança
- Tokens são UUIDs v4 (não adivinháveis)
- Expiração configurável (padrão 7 dias)
- Link single-use (marcado após confirmação)
- Edge Function usa service role para acessar dados, sem expor dados sensíveis ao cliente
- Dados mínimos retornados ao paciente (nome do médico, procedimento, horários)

