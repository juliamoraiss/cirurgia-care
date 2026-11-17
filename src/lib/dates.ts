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

// ---------------------------------------------------------------------------
// Fuso America/Sao_Paulo — "hoje"/"amanhã" não podem depender do fuso do aparelho
// ---------------------------------------------------------------------------

export const APP_TIMEZONE = "America/Sao_Paulo";

/** "AAAA-MM-DD" do dia em São Paulo. */
export function spDayKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(value)
  );
}

/** Quantos dias de calendário (em São Paulo) da data até hoje: 0 = hoje, 1 = amanhã… */
export function spDaysFromToday(value: string | Date, now: Date = new Date()): number {
  const a = new Date(`${spDayKey(value)}T12:00:00Z`).getTime();
  const b = new Date(`${spDayKey(now)}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

/** Início do dia de hoje em São Paulo (instante UTC). Brasil não tem horário de verão desde 2019. */
export function spStartOfToday(now: Date = new Date()): Date {
  return new Date(`${spDayKey(now)}T00:00:00-03:00`);
}

/** "07:00" no fuso de São Paulo. */
export function spTime(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** "Quinta 19/11" (dia da semana por extenso, sem "-feira"). */
export function spWeekdayDate(value: string | Date): string {
  const d = new Date(value);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, weekday: "long" }).format(d).replace("-feira", "");
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit" }).format(d);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date}`;
}

/** "ter, 24 nov 2026" no fuso de São Paulo. */
export function spLongDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(value));
  const get = (t: string) => (parts.find((p) => p.type === t)?.value ?? "").replace(".", "");
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}
