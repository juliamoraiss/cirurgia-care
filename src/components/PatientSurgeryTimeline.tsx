import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Archive,
  CircleDot,
} from "lucide-react";
import { capitalizeFirst } from "@/lib/utils";

interface Props {
  patientId: string;
  currentProcedure: string;
  currentHospital: string | null;
  currentSurgeryDate: string | null;
  currentStatus: string;
}

interface HistoryRow {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface ArchivedSurgery {
  id: string;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  status: string;
  notes: string | null;
  archived_at: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_authorization: "Aguardando autorização",
  authorized: "Autorizado",
  pending_scheduling: "Aguardando agendamento",
  surgery_scheduled: "Cirurgia agendada",
  completed: "Cirurgia realizada",
  cancelled: "Cancelada",
  awaiting_consultation: "Aguardando consulta",
};

function statusLabel(v: string | null) {
  if (!v) return "—";
  return STATUS_LABELS[v] ?? capitalizeFirst(v.replace(/_/g, " "));
}

function fmtDateTime(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

function fmtDateOnly(v: string) {
  return new Date(v).toLocaleDateString("pt-BR");
}

function formatChange(row: HistoryRow): { label: string; from: string; to: string } {
  if (row.field_changed === "status") {
    return {
      label: "Status",
      from: statusLabel(row.old_value),
      to: statusLabel(row.new_value),
    };
  }
  if (row.field_changed === "surgery_date") {
    return {
      label: "Data da cirurgia",
      from: fmtDateTime(row.old_value),
      to: fmtDateTime(row.new_value),
    };
  }
  return {
    label: row.field_changed,
    from: row.old_value ?? "—",
    to: row.new_value ?? "—",
  };
}

interface SurgeryGroup {
  key: string;
  title: string;
  isCurrent: boolean;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  status: string;
  archived_at?: string;
  events: HistoryRow[];
}

export function PatientSurgeryTimeline({
  patientId,
  currentProcedure,
  currentHospital,
  currentSurgeryDate,
  currentStatus,
}: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [archived, setArchived] = useState<ArchivedSurgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>("current");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, a] = await Promise.all([
        supabase
          .from("patient_history")
          .select("id, field_changed, old_value, new_value, created_at")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: true }),
        supabase
          .from("patient_surgeries")
          .select(
            "id, procedure, hospital, surgery_date, status, notes, archived_at, created_at"
          )
          .eq("patient_id", patientId)
          .order("archived_at", { ascending: true }),
      ]);
      if (!alive) return;
      setHistory((h.data as HistoryRow[]) || []);
      setArchived((a.data as ArchivedSurgery[]) || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [patientId]);

  const groups = useMemo<SurgeryGroup[]>(() => {
    const result: SurgeryGroup[] = [];
    let cursor = 0;
    const sorted = [...archived].sort(
      (a, b) =>
        new Date(a.archived_at).getTime() - new Date(b.archived_at).getTime()
    );
    sorted.forEach((s, idx) => {
      const archivedAt = new Date(s.archived_at).getTime();
      const evs: HistoryRow[] = [];
      while (
        cursor < history.length &&
        new Date(history[cursor].created_at).getTime() <= archivedAt
      ) {
        evs.push(history[cursor]);
        cursor++;
      }
      result.push({
        key: s.id,
        title: `Cirurgia #${idx + 1} • ${capitalizeFirst(s.procedure)}`,
        isCurrent: false,
        procedure: s.procedure,
        hospital: s.hospital,
        surgery_date: s.surgery_date,
        status: s.status,
        archived_at: s.archived_at,
        events: evs,
      });
    });
    const currentEvents = history.slice(cursor);
    result.push({
      key: "current",
      title: `Cirurgia atual • ${capitalizeFirst(currentProcedure || "—")}`,
      isCurrent: true,
      procedure: currentProcedure,
      hospital: currentHospital,
      surgery_date: currentSurgeryDate,
      status: currentStatus,
      events: currentEvents,
    });
    // Most recent first: current on top, then newest archived
    return result.reverse();
  }, [history, archived, currentProcedure, currentHospital, currentSurgeryDate, currentStatus]);

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Linha do Tempo por Cirurgia</CardTitle>
        </div>
        <CardDescription>
          Status e mudanças registradas em cada cirurgia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((g) => {
          const open = openKey === g.key;
          return (
            <Collapsible
              key={g.key}
              open={open}
              onOpenChange={(o) => setOpenKey(o ? g.key : null)}
            >
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full p-3 flex items-start justify-between gap-3 hover:bg-muted/50 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{g.title}</span>
                      {g.isCurrent ? (
                        <Badge variant="default" className="gap-1">
                          <CircleDot className="h-3 w-3" /> Atual
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Archive className="h-3 w-3" /> Arquivada
                        </Badge>
                      )}
                      <Badge variant="outline">{statusLabel(g.status)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      {g.surgery_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDateTime(g.surgery_date)}
                        </span>
                      )}
                      {g.hospital && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {g.hospital}
                        </span>
                      )}
                      {g.archived_at && (
                        <span className="flex items-center gap-1">
                          <Archive className="h-3 w-3" />
                          Arquivada em {fmtDateOnly(g.archived_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {g.events.length} evento(s)
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                    {g.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhuma mudança de status registrada nesta cirurgia.
                      </p>
                    ) : (
                      <ol className="relative border-l border-border ml-2 mt-2 space-y-3">
                        {[...g.events].reverse().map((ev) => {
                          const c = formatChange(ev);
                          return (
                            <li key={ev.id} className="ml-4">
                              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                              <div className="text-xs text-muted-foreground">
                                {fmtDateTime(ev.created_at)}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">{c.label}:</span>{" "}
                                <span className="text-muted-foreground line-through">
                                  {c.from}
                                </span>{" "}
                                → <span className="font-medium">{c.to}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
