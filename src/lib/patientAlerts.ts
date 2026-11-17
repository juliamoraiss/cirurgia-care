import { differenceInCalendarDays } from "date-fns";

/** Exames exigidos (soma dos procedimentos, quando há mais de um). */
export function getExamsForProcedure(procedure: string): string[] {
  const list = procedure
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 1) return Array.from(new Set(list.flatMap((p) => examsForSingleProcedure(p))));
  return examsForSingleProcedure(list[0] || "");
}

/** Exames de um procedimento (itens com "opcional" não contam como pendência). */
function examsForSingleProcedure(procedure: string): string[] {
  const examsMap: Record<string, string[]> = {
    simpatectomia: ["Risco Cirúrgico Cardiológico"],
    lobectomia: [
      "PET - CT",
      "Risco cardiológico",
      "Risco Pneumologico",
      "Ressonância Magnética de Crânio",
      "Resultado de biopsia",
      "Última tomografia do tórax (opcional)",
    ],
    rinoplastia: [],
    broncoscopia: ["Risco cardiológico (opcional)"],
  };
  return examsMap[procedure] || [];
}

export interface PatientIssue {
  label: string;
  severity: "warning" | "danger";
}

interface PatientForAlerts {
  procedure: string;
  status?: string | null;
  surgery_date?: string | null;
  exams_checklist?: string[] | null;
  guide_validity_date?: string | null;
}

const GUIDE_WARNING_DAYS = 7;

/**
 * Pendências reais do paciente — só elas ganham cor de alerta.
 * Cirurgia "amanhã" é normal e não é pendência.
 */
export function getPatientIssues(p: PatientForAlerts, now: Date = new Date()): PatientIssue[] {
  const issues: PatientIssue[] = [];
  const hasSurgery = !!p.surgery_date && new Date(p.surgery_date) > now;

  if (hasSurgery && (p.status === "awaiting_authorization" || p.status === "awaiting_consultation")) {
    issues.push({ label: "Sem autorização", severity: "danger" });
  }

  const required = getExamsForProcedure(p.procedure).filter((e) => !/opcional/i.test(e));
  const checked = p.exams_checklist || [];
  const missing = required.filter((e) => !checked.includes(e));
  if (missing.length > 0 && p.status !== "completed" && p.status !== "cancelled") {
    issues.push({
      label: missing.length === 1 ? "1 exame pendente" : `${missing.length} exames pendentes`,
      severity: hasSurgery && differenceInCalendarDays(new Date(p.surgery_date!), now) <= 3 ? "danger" : "warning",
    });
  }

  if (p.guide_validity_date && p.status !== "completed" && p.status !== "cancelled") {
    const validity = new Date(`${p.guide_validity_date}T23:59:59`);
    const daysLeft = differenceInCalendarDays(validity, now);
    if (hasSurgery && new Date(p.surgery_date!) > validity) {
      issues.push({ label: "Guia vence antes da cirurgia", severity: "danger" });
    } else if (daysLeft < 0) {
      issues.push({ label: "Guia vencida", severity: "danger" });
    } else if (daysLeft <= GUIDE_WARNING_DAYS) {
      issues.push({ label: daysLeft === 0 ? "Guia vence hoje" : `Guia vence em ${daysLeft}d`, severity: "warning" });
    }
  }

  return issues;
}
