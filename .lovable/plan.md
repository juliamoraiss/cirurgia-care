
## Objetivo

Permitir que você selecione uma mensagem no WhatsApp, toque em "Compartilhar" e escolha o MedSystem. O app abre numa tela de revisão com os dados da cirurgia já extraídos pela IA (paciente, procedimento, hospital, data e hora). Você confirma com 1 toque e a cirurgia é criada — disparando automaticamente toda a automação que já existe (Google Calendar do médico, tarefas pré/pós-op, confirmações).

## Como vai funcionar (fluxo)

```
WhatsApp → "Compartilhar" → MedSystem
            ↓
    /share-cirurgia (texto colado)
            ↓
    Edge Function (IA Lovable: Gemini)
            ↓
    Tela de revisão com campos preenchidos:
      • Paciente (busca nos existentes ou cria novo)
      • Procedimento
      • Hospital
      • Data e hora
      • Médico responsável
            ↓
    [Confirmar] → cria patient + surgery_date
            ↓
    Triggers existentes:
      • Sincroniza Google Calendar
      • Cria tarefas pré-op, pós-op, confirmações
      • Notifica médico
```

## O que vai ser construído

### 1. PWA Share Target (recebe o "Compartilhar" do sistema)
Adicionar `share_target` no `public/manifest.json`. Quando você compartilhar texto do WhatsApp e escolher MedSystem, o sistema operacional abre o app na rota `/share-cirurgia?text=...` com a mensagem já no parâmetro.

Importante: para isso funcionar, o app precisa estar **instalado** na tela inicial (já está configurado como PWA standalone).

### 2. Edge Function `parse-surgery-message`
Recebe o texto bruto e usa a IA do Lovable (Gemini Flash, sem custo extra) com structured output para extrair:
- Nome do paciente
- Procedimento
- Hospital (se mencionado)
- Data e hora (interpretando "amanhã", "sexta às 14h", "20/05 às 8h", etc. usando timezone São Paulo)
- Médico (se mencionado pelo nome — faz match com profissionais cadastrados)
- Nível de confiança da extração

Validação Bearer token (igual às outras edge functions do projeto).

### 3. Página `/share-cirurgia`
- Mostra o texto original recebido (read-only, pra referência)
- Campos preenchidos automaticamente, todos editáveis
- Combobox de paciente: busca entre pacientes existentes; se não encontrar, oferece "Criar novo paciente: [nome]"
- Seletor de médico responsável (só admin vê; profissional usa o próprio)
- Indicador visual de confiança da IA (alta/média/baixa) por campo
- Botão **Confirmar e agendar** → cria/atualiza paciente, define `surgery_date`
- Botão **Cancelar**

A criação reusa a mesma lógica do `PatientForm.tsx` que já existe, então toda a automação atual (Google Calendar, tarefas, notificações) dispara naturalmente.

### 4. Botão de fallback (caso desktop / sem instalar)
Adicionar botão **"Importar cirurgia do WhatsApp"** no FAB ou no menu, que abre a mesma tela `/share-cirurgia` com um campo "cole a mensagem aqui".

## Detalhes técnicos

**Manifest share_target:**
```json
"share_target": {
  "action": "/share-cirurgia",
  "method": "GET",
  "params": { "text": "text", "title": "title" }
}
```

**Stack da extração:** chamada ao gateway Lovable AI com `google/gemini-3-flash-preview` + JSON schema estruturado para garantir formato consistente. Prompt em pt-BR com exemplos e a data de hoje (timezone SP) como contexto pra interpretar datas relativas.

**Match de paciente:** busca por nome similar (ILIKE) entre pacientes do médico responsável. Se a IA encontrar 1 match com score alto, pré-seleciona; se múltiplos, mostra lista; se nenhum, oferece criar.

**Sem novas tabelas, sem novas migrations** — usa `patients` e triggers existentes.

**Sem custo de API externa** — IA do Lovable é gratuita pra esse volume.

## Limitações honestas

- Share target do PWA só funciona com app **instalado** na tela inicial (Android funciona muito bem; iOS suporta desde iOS 16.4 mas é menos polido — pode precisar abrir o Safari uma vez antes).
- Para uso 100% nativo (atalho do iOS Shortcuts ou app na App Store), seria necessário Capacitor — fora do escopo desta etapa, mas dá pra evoluir depois.
- A IA pode errar; por isso a tela de revisão é obrigatória antes de salvar.

## Arquivos que vão mudar

- `public/manifest.json` — adicionar `share_target`
- `supabase/functions/parse-surgery-message/index.ts` — nova edge function
- `supabase/config.toml` — registrar a função com `verify_jwt = false`
- `src/pages/ShareCirurgia.tsx` — nova página
- `src/App.tsx` — registrar rota `/share-cirurgia`
- `src/components/FAB.tsx` (ou menu) — botão "Importar do WhatsApp"

## Próximo passo

Se aprovar, eu implemento. Após o deploy, você precisa **reinstalar o PWA na tela inicial** uma vez para o sistema operacional reconhecer o novo share target.
