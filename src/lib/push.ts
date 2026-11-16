/**
 * Chave PÚBLICA VAPID usada para inscrever o navegador em Web Push.
 * É pública por definição (vai para o navegador). A chave privada correspondente
 * fica só no Supabase, no secret VAPID_PRIVATE_KEY, usado pela função
 * send-task-notifications.
 */
export const VAPID_PUBLIC_KEY =
  "BAjXqWdHCeJQJMHRpn6Zz0M6kWD3jrhzaM59nl3cUrz3KEtfqm0tmQED6L7Fq_E843bLo7z9v_uIb0RpYarqbUs";
