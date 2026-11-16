/** Opções dos campos do paciente (mesmos valores já gravados no banco). */

export const PROCEDURE_OPTIONS = [
  { value: "rinoplastia", label: "Rinoplastia" },
  { value: "simpatectomia", label: "Simpatectomia" },
  { value: "lobectomia", label: "Lobectomia" },
  { value: "broncoscopia", label: "Broncoscopia" },
  { value: "troca de cânula", label: "Troca de cânula" },
  { value: "controle", label: "Controle" },
];

export const DEFAULT_INSURANCES = [
  "ASSEFAZ",
  "FUSEX",
  "GEAP",
  "INAS (GDF Saúde)",
  "PLENUM SAÚDE",
  "PMDF",
  "PORTO SEGURO - SEGURO SAUDE S/A",
  "POSTAL SAUDE",
  "QUALLITY",
  "SULAMERICA",
  "Particular",
];

export type PatientStatusValue =
  | "awaiting_consultation"
  | "awaiting_authorization"
  | "authorized"
  | "pending_scheduling"
  | "surgery_scheduled"
  | "surgery_completed"
  | "completed"
  | "cancelled";

/** Etapas em ordem, com cor. */
export const STATUS_FLOW: { value: PatientStatusValue; label: string; dot: string }[] = [
  { value: "awaiting_consultation", label: "Aguardando consulta", dot: "bg-slate-400" },
  { value: "awaiting_authorization", label: "Aguardando autorização", dot: "bg-amber-500" },
  { value: "authorized", label: "Autorizado", dot: "bg-emerald-500" },
  { value: "pending_scheduling", label: "Aguardando agendamento", dot: "bg-sky-500" },
  { value: "surgery_scheduled", label: "Cirurgia agendada", dot: "bg-emerald-600" },
  { value: "surgery_completed", label: "Cirurgia realizada (pós-op)", dot: "bg-slate-500" },
  { value: "completed", label: "Concluído", dot: "bg-slate-600" },
  { value: "cancelled", label: "Cancelado", dot: "bg-red-500" },
];

export function statusInfo(value: string) {
  return STATUS_FLOW.find((s) => s.value === value) ?? STATUS_FLOW[1];
}

export const ONCOLOGY_STAGES = [
  { value: "I", label: "Estágio I - Inicial" },
  { value: "II", label: "Estágio II - Localizado" },
  { value: "III", label: "Estágio III - Avançado local" },
  { value: "IV", label: "Estágio IV - Metastático" },
  { value: "Recidiva", label: "Recidiva" },
  { value: "Remissão", label: "Remissão" },
];

export const ORIGEM_OPTIONS = ["Sistema", "Tráfego Pago"];

/** Horários mais usados, como atalho no campo de data da cirurgia. */
export const COMMON_SURGERY_TIMES = ["07:00", "10:00", "13:00", "14:00"];
