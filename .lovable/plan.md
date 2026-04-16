

# Chatbot no Site com Link de Agendamento

## Objetivo
Adicionar um widget de chat flutuante no site público que simula um atendente virtual. Quando o visitante envia uma mensagem, o chatbot responde automaticamente com uma saudação e encaminha o link de agendamento.

## Como vai funcionar
1. Um botão flutuante de WhatsApp/chat aparece no canto inferior direito das páginas públicas
2. Ao clicar, abre uma janela de chat simples
3. O visitante digita seu nome ou mensagem
4. O chatbot responde automaticamente com uma saudação personalizada e um link para a página de agendamento público (`/agendar/`)
5. O chatbot pode coletar nome e telefone do lead antes de enviar o link

## Implementação

### 1. Componente `ChatWidget.tsx`
- Botão flutuante com ícone de WhatsApp (verde, posição fixa bottom-right)
- Ao clicar, expande uma janela de chat estilizada
- Interface de conversa com bolhas de mensagem
- Fluxo automático:
  - Bot: "Olá! 👋 Sou o assistente virtual do Dr. André Alves. Como posso ajudar?"
  - Usuário digita qualquer mensagem
  - Bot: "Para agendar sua consulta, acesse nosso link de agendamento: [link]. Se preferir, me diga seu nome e telefone que entraremos em contato!"
- Opção de capturar dados do lead (nome, telefone) e salvar no banco

### 2. Tabela `chat_leads` (banco de dados)
- `id`, `name`, `phone`, `message`, `created_at`
- Para registrar leads que interagem com o chatbot
- RLS: insert público (anon), select apenas para autenticados

### 3. Integração
- Adicionar o widget na página `PublicSchedule` e/ou no `index.html`
- O link de agendamento será dinâmico baseado no profissional

### Arquivos modificados/criados
- **Novo**: `src/components/ChatWidget.tsx` — Widget de chat flutuante
- **Modificado**: `src/pages/PublicSchedule.tsx` — Incluir o widget
- **Migração**: Criar tabela `chat_leads` para salvar contatos

