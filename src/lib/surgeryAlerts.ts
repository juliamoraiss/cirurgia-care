import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { spDaysFromToday, spStartOfToday } from "@/lib/dates";
import { getExamsForProcedure } from "@/lib/patientAlerts";

/** Pendência de uma cirurgia de hoje/amanhã, com o caminho da ação que resolve. */
export interface SurgeryAlert {
  key: "preop" | "exams" | "authorization" | "to_confirm";
  label: string;
  path: string;
}

interface AlertPatient {
  id: string;
  procedure: string;
  status?: string | null;
  surgery_to_confirm?: boolean | null;
  exams_checklist?: string[] | null;
}

export function getSurgeryAlerts(p: AlertPatient, hasOpenPreOp: boolean): SurgeryAlert[] {
  const alerts: SurgeryAlert[] = [];
  if (hasOpenPreOp) {
    // A ficha tem o botão de enviar as orientações (seção de tarefas)
    alerts.push({ key: "preop", label: "Orientações pré-op não enviadas", path: `/patients/${p.id}/exams#tarefas` });
  }
  const required = getExamsForProcedure(p.procedure).filter((e) => !/opcional/i.test(e));
  const checked = p.exams_checklist || [];
  if (required.some((e) => !checked.includes(e))) {
    alerts.push({ key: "exams", label: "Exames pendentes", path: `/patients/${p.id}?section=exames` });
  }
  if (p.status === "awaiting_authorization" || p.status === "awaiting_consultation") {
    alerts.push({ key: "authorization", label: "Autorização pendente", path: `/patients/${p.id}?section=autorizacao` });
  }
  if (p.surgery_to_confirm) {
    alerts.push({ key: "to_confirm", label: "Data a confirmar", path: `/patients/${p.id}?section=cirurgia` });
  }
  return alerts;
}

/** Cirurgia é hoje (0) ou amanhã (1) no fuso de São Paulo? */
export function isTodayOrTomorrowSP(surgeryDate: string, now: Date = new Date()) {
  const d = spDaysFromToday(surgeryDate, now);
  return d === 0 || d === 1;
}

/**
 * Pendências das cirurgias de hoje e amanhã (São Paulo). Usado na lista
 * "Próximas cirurgias" e no selo da aba Início.
 */
export function useTodayTomorrowAlerts(refreshKey?: unknown) {
  const [alerts, setAlerts] = useState<Map<string, SurgeryAlert[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = spStartOfToday();
      const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
      const { data: patients } = await supabase
        .from("patients")
        .select("id, procedure, status, surgery_date, surgery_to_confirm, exams_checklist")
        .gte("surgery_date", start.toISOString())
        .lt("surgery_date", end.toISOString())
        .not("status", "in", '("cancelled","completed")');
      const ids = (patients || []).map((p) => p.id);
      let preOpOpen = new Set<string>();
      if (ids.length) {
        const { data: tasks } = await supabase
          .from("patient_tasks")
          .select("patient_id")
          .eq("task_type", "pre_op_instructions")
          .eq("completed", false)
          .in("patient_id", ids);
        preOpOpen = new Set((tasks || []).map((t) => t.patient_id));
      }
      if (cancelled) return;
      const map = new Map<string, SurgeryAlert[]>();
      for (const p of patients || []) {
        const list = getSurgeryAlerts(p, preOpOpen.has(p.id));
        if (list.length) map.set(p.id, list);
      }
      setAlerts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { alerts, count: alerts.size };
}
