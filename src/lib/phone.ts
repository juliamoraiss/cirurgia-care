/** Telefone brasileiro: aceita colar "+55 61 99999-9999", espaços etc. */

/** Só os dígitos, sem o 55 do país quando colado com DDI. */
export function normalizePhoneDigits(input: string): string {
  let digits = (input || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
}

/** Máscara progressiva: (61) 99999-9999 / (61) 3333-4444 */
export function formatPhone(input: string): string {
  const d = normalizePhoneDigits(input);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export function isPhoneComplete(input: string): boolean {
  const d = normalizePhoneDigits(input);
  return d.length === 10 || d.length === 11;
}

/** Mensagem de validação em linguagem simples (ou null se ok/vazio). */
export function phoneError(input: string): string | null {
  const d = normalizePhoneDigits(input);
  if (d.length === 0) return null;
  if (d.length < 10) return "Telefone incompleto";
  if (d.length === 11 && d[2] !== "9") return "Celular deve começar com 9 depois do DDD";
  return null;
}
