import { HOSPITAL_OPTIONS } from "@/lib/hospitals";

/** Opções dos filtros da tela Pacientes (iguais no celular e no computador). */
export const PROCEDURE_FILTER_OPTIONS = [
  "simpatectomia",
  "lobectomia",
  "broncoscopia",
  "rinoplastia",
  "troca de cânula",
];

export const HOSPITAL_FILTER_OPTIONS = HOSPITAL_OPTIONS;

export const STATUS_FILTER_OPTIONS = [
  { value: "awaiting_consultation", label: "Aguardando Consulta" },
  { value: "awaiting_authorization", label: "Aguardando Autorização" },
  { value: "authorized", label: "Autorizado" },
  { value: "pending_scheduling", label: "Ag. Agendamento" },
  { value: "surgery_scheduled", label: "Cirurgia Agendada" },
  { value: "surgery_completed", label: "Cirurgia Realizada" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

export const DEFAULT_STATUS_FILTER = ["authorized", "awaiting_authorization", "pending_scheduling", "surgery_scheduled"];

export interface PatientFilters {
  procedures: string[];
  hospitals: string[];
  statuses: string[];
}

export const EMPTY_FILTERS: PatientFilters = { procedures: [], hospitals: [], statuses: [] };

export function countFilters(f: PatientFilters) {
  return f.procedures.length + f.hospitals.length + f.statuses.length;
}

export function statusLabel(value: string) {
  return STATUS_FILTER_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

export function shortHospital(name: string) {
  return name.replace(/^Hospital\s+/i, "");
}

export function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
