import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfessionals } from "@/hooks/useProfessionals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToConfirmBadge } from "@/components/ToConfirmBadge";
import { ensureHospitalRegistered } from "@/lib/hospitals";
import { DEFAULT_RESPONSIBLE_DOCTOR_ID } from "@/lib/defaults";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  type ComparedRow,
  type ExistingPatient,
  type RowStatus,
  compareSurgeryList,
  compareWithPatient,
  parseSurgeryList,
  resolveHospitalNames,
  DEFAULT_SURGERY_HOUR,
} from "@/lib/surgeryList";

interface RowState extends ComparedRow {
  key: number;
  selected: boolean;
  toConfirm: boolean;
  result?: { ok: boolean; message: string };
}

const STATUS_INFO: Record<RowStatus, { label: string; className: string }> = {
  new: { label: "Novo", className: "bg-success/15 text-success border-success/30" },
  changed: { label: "Mudou", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  duplicate: { label: "Repetido", className: "bg-muted text-muted-foreground border-border" },
  invalid: { label: "Não entendi", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function formatDateTime(date: Date, hasTime: boolean) {
  const day = format(date, "EEE dd/MM/yy", { locale: ptBR });
  return hasTime ? `${day} às ${format(date, "HH:mm")}` : `${day} (sem horário → ${String(DEFAULT_SURGERY_HOUR).padStart(2, "0")}:00)`;
}

function formatExisting(iso: string | null) {
  if (!iso) return "sem data";
  return format(new Date(iso), "dd/MM/yy HH:mm");
}

interface BatchSurgeryImportProps {
  text: string;
  onCancel: () => void;
}

/**
 * Importação de uma LISTA de cirurgias: lê cada linha, compara com o que já
 * existe (novo / mudou / repetido) e só grava o que a usuária marcar.
 */
export function BatchSurgeryImport({ text, onCancel }: BatchSurgeryImportProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { professionals } = useProfessionals();

  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [doctorId, setDoctorId] = useState(DEFAULT_RESPONSIBLE_DOCTOR_ID);

  // Lê a lista e compara com os pacientes cadastrados
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFinished(false);
      try {
        const [{ data: hospitals }, { data: patients, error }] = await Promise.all([
          supabase.from("hospitals").select("name"),
          supabase
            .from("patients")
            .select(
              "id, name, procedure, hospital, insurance, surgery_date, surgery_to_confirm, status, responsible_user_id, google_calendar_event_id"
            ),
        ]);
        if (error) throw error;

        const parsed = resolveHospitalNames(
          parseSurgeryList(text),
          (hospitals ?? []).map((h: { name: string }) => h.name)
        );
        const compared = compareSurgeryList(parsed, (patients ?? []) as ExistingPatient[]);
        if (cancelled) return;
        setRows(
          compared.map((row, key) => ({
            ...row,
            key,
            selected: row.status === "new" || row.status === "changed",
            toConfirm: false,
          }))
        );
      } catch (error) {
        toast.error(describeError("Erro ao ler a lista", error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [text]);

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { new: 0, changed: 0, duplicate: 0, invalid: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const selectedRows = rows.filter((r) => r.selected && r.status !== "invalid" && !r.result?.ok);
  const allToConfirm = rows.length > 0 && rows.filter((r) => r.status !== "invalid").every((r) => r.toConfirm);

  const updateRow = (key: number, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Trocar o paciente associado (ou "criar novo") recalcula o status da linha
  const chooseMatch = (row: RowState, value: string) => {
    const match = value === "new" ? null : row.candidates.find((c) => c.patient.id === value)?.patient ?? null;
    const { status, changes } = compareWithPatient(row.parsed, match);
    updateRow(row.key, { match, status, changes, selected: status === "new" || status === "changed" });
  };

  async function handleSave() {
    if (!user || selectedRows.length === 0) return;
    setSaving(true);
    const hospitalCache = new Map<string, string>();
    let okCount = 0;
    let calendarFailures = 0;

    for (const row of selectedRows) {
      const { parsed, match } = row;
      try {
        const surgeryIso = parsed.date!.toISOString();
        let hospitalFinal: string | null = null;
        if (parsed.hospital) {
          if (!hospitalCache.has(parsed.hospital)) {
            hospitalCache.set(parsed.hospital, await ensureHospitalRegistered(parsed.hospital, user.id));
          }
          hospitalFinal = hospitalCache.get(parsed.hospital) || null;
        }

        let patientId: string;
        let targetDoctor: string;
        if (match) {
          const { error } = await supabase
            .from("patients")
            .update({
              surgery_date: surgeryIso,
              surgery_to_confirm: row.toConfirm,
              ...(hospitalFinal ? { hospital: hospitalFinal } : {}),
              ...(parsed.insurance ? { insurance: parsed.insurance } : {}),
            })
            .eq("id", match.id);
          if (error) throw error;
          patientId = match.id;
          targetDoctor = match.responsible_user_id || doctorId;
        } else {
          const responsible = isAdmin ? doctorId : user.id;
          const { data, error } = await supabase
            .from("patients")
            .insert([
              {
                name: parsed.name,
                procedure: parsed.procedure,
                hospital: hospitalFinal,
                insurance: parsed.insurance,
                surgery_date: surgeryIso,
                surgery_to_confirm: row.toConfirm,
                status: "surgery_scheduled" as const,
                responsible_user_id: responsible,
                created_by: user.id,
                origem: "whatsapp",
              },
            ])
            .select("id")
            .single();
          if (error) throw error;
          patientId = data.id;
          targetDoctor = responsible;
        }

        // Google Agenda do médico responsável
        try {
          const { data: cal, error: calError } = await supabase.functions.invoke("google-calendar-create-event", {
            body: {
              action: match?.google_calendar_event_id ? "update" : "create",
              patient_name: match?.name ?? parsed.name,
              procedure: match?.procedure ?? parsed.procedure,
              hospital: hospitalFinal ?? match?.hospital ?? null,
              surgery_date: surgeryIso,
              to_confirm: row.toConfirm,
              notes: "Importado via WhatsApp (lista)",
              patient_id: patientId,
              target_user_id: targetDoctor,
              existing_event_id: match?.google_calendar_event_id ?? null,
            },
          });
          const calRes = cal as { success?: boolean; connected?: boolean } | null;
          if (calError || (!calRes?.success && calRes?.connected !== false)) calendarFailures++;
        } catch {
          calendarFailures++;
        }

        okCount++;
        updateRow(row.key, { result: { ok: true, message: match ? "Atualizado" : "Criado" } });
      } catch (error) {
        updateRow(row.key, { result: { ok: false, message: describeError("Erro", error) } });
      }
    }

    setSaving(false);
    setFinished(true);
    const failed = selectedRows.length - okCount;
    if (failed === 0) toast.success(`${okCount} ${okCount === 1 ? "cirurgia salva" : "cirurgias salvas"}`);
    else toast.warning(`${okCount} salvas, ${failed} com erro. Veja as linhas marcadas em vermelho.`);
    if (calendarFailures > 0) {
      toast.warning(`${calendarFailures} não foram sincronizadas com o Google Agenda.`);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lendo a lista e comparando com a agenda...
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Não encontrei nenhuma linha de cirurgia. Use uma linha por paciente, no formato
        <span className="block mt-1 font-mono text-xs">NOME - cirurgia DD/MM/AA - 07h - Hospital - Convênio</span>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Resumo */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(STATUS_INFO) as RowStatus[]).map((status) =>
          counts[status] > 0 ? (
            <span key={status} className={cn("rounded-full border px-2 py-0.5 font-medium", STATUS_INFO[status].className)}>
              {counts[status]} {STATUS_INFO[status].label.toLowerCase()}
            </span>
          ) : null
        )}
      </div>

      {/* Opções gerais */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isAdmin && (
          <div className="space-y-1.5">
            <Label className="text-xs">Médico responsável (pacientes novos)</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={saving}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione o médico" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer self-end pb-1.5">
          <Checkbox
            checked={allToConfirm}
            disabled={saving}
            onCheckedChange={(checked) =>
              setRows((prev) => prev.map((r) => (r.status === "invalid" ? r : { ...r, toConfirm: checked === true })))
            }
          />
          Marcar todas como "a confirmar"
        </label>
      </div>

      {/* Linhas */}
      <div className="space-y-2">
        {rows.map((row) => {
          const { parsed } = row;
          const info = STATUS_INFO[row.status];
          const disabled = saving || row.status === "invalid" || !!row.result?.ok;
          return (
            <div
              key={row.key}
              className={cn(
                "rounded-lg border p-3 space-y-2 transition-colors",
                row.selected && row.status !== "invalid" ? "bg-card" : "bg-muted/30",
                row.result?.ok && "border-success/50",
                row.result && !row.result.ok && "border-destructive/60"
              )}
            >
              <div className="flex items-start gap-2.5">
                <Checkbox
                  checked={row.selected && row.status !== "invalid"}
                  disabled={disabled}
                  onCheckedChange={(checked) => updateRow(row.key, { selected: checked === true })}
                  className="mt-0.5"
                  aria-label={`Salvar ${parsed.name || `linha ${parsed.lineNumber}`}`}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full border px-1.5 py-px text-[11px] font-medium", info.className)}>
                      {info.label}
                    </span>
                    <span className="font-semibold text-sm truncate">{parsed.name || "—"}</span>
                    {row.toConfirm && row.status !== "invalid" && <ToConfirmBadge />}
                  </div>

                  {row.status === "invalid" ? (
                    <>
                      <p className="text-xs text-destructive">{parsed.error}</p>
                      <p className="text-xs text-muted-foreground font-mono break-words">
                        Linha {parsed.lineNumber}: {parsed.raw}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={cn("text-xs", !parsed.hasTime && "text-amber-700 dark:text-amber-400")}>
                        {formatDateTime(parsed.date!, parsed.hasTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[parsed.hospital, parsed.insurance, parsed.procedureFromText ? parsed.procedure : null]
                          .filter(Boolean)
                          .join(" · ") || "Sem hospital/convênio"}
                      </p>

                      {/* O que muda em relação ao cadastro atual */}
                      {row.status === "changed" && row.match && (
                        <ul className="text-xs space-y-0.5 rounded-md bg-amber-500/10 px-2 py-1.5">
                          {(row.changes.includes("data") || row.changes.includes("hora")) && (
                            <li>
                              Data/hora: <span className="line-through text-muted-foreground">{formatExisting(row.match.surgery_date)}</span>{" "}
                              <ArrowRight className="inline h-3 w-3" /> {format(parsed.date!, "dd/MM/yy HH:mm")}
                            </li>
                          )}
                          {row.changes.includes("hospital") && (
                            <li>
                              Hospital: <span className="line-through text-muted-foreground">{row.match.hospital || "—"}</span>{" "}
                              <ArrowRight className="inline h-3 w-3" /> {parsed.hospital}
                            </li>
                          )}
                          {row.changes.includes("convênio") && (
                            <li>
                              Convênio: <span className="line-through text-muted-foreground">{row.match.insurance || "—"}</span>{" "}
                              <ArrowRight className="inline h-3 w-3" /> {parsed.insurance}
                            </li>
                          )}
                        </ul>
                      )}
                      {row.status === "duplicate" && (
                        <p className="text-xs text-muted-foreground">Já está assim na agenda.</p>
                      )}

                      {/* Paciente associado: escolher entre parecidos ou criar novo */}
                      {row.candidates.length > 0 && !row.result?.ok && (
                        <Select
                          value={row.match?.id ?? "new"}
                          onValueChange={(v) => chooseMatch(row, v)}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {row.candidates.map((c) => (
                              <SelectItem key={c.patient.id} value={c.patient.id} className="text-xs">
                                Atualizar {c.patient.name} ({formatExisting(c.patient.surgery_date)})
                              </SelectItem>
                            ))}
                            <SelectItem value="new" className="text-xs">
                              Criar novo paciente
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <label className="flex items-center gap-1.5 text-xs cursor-pointer w-fit">
                        <Checkbox
                          checked={row.toConfirm}
                          disabled={disabled}
                          onCheckedChange={(checked) => updateRow(row.key, { toConfirm: checked === true })}
                          className="h-3.5 w-3.5"
                        />
                        A confirmar
                      </label>
                    </>
                  )}

                  {row.result && (
                    <p className={cn("text-xs flex items-center gap-1", row.result.ok ? "text-success" : "text-destructive")}>
                      {row.result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {row.result.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.some((r) => r.status !== "invalid" && !r.parsed.hasTime) && (
        <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
          Linhas sem horário serão salvas às {String(DEFAULT_SURGERY_HOUR).padStart(2, "0")}:00.
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
          {finished ? "Importar outra lista" : "Cancelar"}
        </Button>
        {finished && selectedRows.length === 0 ? (
          <Button onClick={() => navigate("/calendar")} className="flex-1">
            <CalendarDays className="h-4 w-4 mr-2" />
            Ver na Agenda
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || selectedRows.length === 0} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving
              ? "Salvando..."
              : `Salvar ${selectedRows.length} ${selectedRows.length === 1 ? "selecionada" : "selecionadas"}`}
          </Button>
        )}
      </div>
    </Card>
  );
}
