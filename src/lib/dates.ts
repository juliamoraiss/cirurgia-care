import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

/** "ter 17/11, 10:00" (ou "hoje, 10:00" / "amanhã, 10:00") — listas compactas. */
export function shortDateTime(value: string | Date): string {
  const d = new Date(value);
  const time = format(d, "HH:mm");
  if (isToday(d)) return `hoje, ${time}`;
  if (isTomorrow(d)) return `amanhã, ${time}`;
  return `${format(d, "EEE dd/MM", { locale: ptBR }).replace(".", "")}, ${time}`;
}

/** "ter, 17 nov 2026 · 10:00" — ficha do paciente (sem segundos, com dia da semana). */
export function longDateTime(value: string | Date): string {
  const d = new Date(value);
  return format(d, "EEE, d MMM yyyy '·' HH:mm", { locale: ptBR }).replace(/\./g, "");
}

/** "ter, 17 nov 2026" */
export function longDate(value: string | Date): string {
  return format(new Date(value), "EEE, d MMM yyyy", { locale: ptBR }).replace(/\./g, "");
}

/** "Novembro de 2026" (com maiúscula). */
export function monthYear(value: Date): string {
  const s = format(value, "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
