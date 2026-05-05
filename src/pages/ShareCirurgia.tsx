import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfessionals } from "@/hooks/useProfessionals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout } from "@/components/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Confidence = "high" | "medium" | "low" | "none";

interface ExtractedData {
  patient_name: string | null;
  procedure: string | null;
  hospital: string | null;
  surgery_datetime: string | null;
  doctor_name: string | null;
  confidence: Record<string, Confidence>;
}

interface PatientMatch {
  id: string;
  name: string;
  procedure: string;
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  if (level === "high") return <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">IA: alta</Badge>;
  if (level === "medium") return <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">IA: média</Badge>;
  if (level === "low") return <Badge variant="secondary" className="bg-destructive/15 text-destructive text-[10px]">IA: baixa</Badge>;
  return null;
}

export default function ShareCirurgia() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { professionals } = useProfessionals();

  const sharedText = searchParams.get("text") || searchParams.get("title") || "";

  const [rawText, setRawText] = useState(sharedText);
  const [parsing, setParsing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  const [patientName, setPatientName] = useState("");
  const [procedure, setProcedure] = useState("");
  const [hospital, setHospital] = useState("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | "new">("new");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Auto-parse if text was shared
  useEffect(() => {
    if (sharedText && sharedText.trim().length > 5) {
      handleParse(sharedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-set responsible to self for non-admins
  useEffect(() => {
    if (!isAdmin && user) setResponsibleUserId(user.id);
  }, [isAdmin, user]);

  async function handleParse(text: string) {
    if (!text.trim()) {
      toast.error("Cole a mensagem antes de analisar");
      return;
    }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-surgery-message", {
        body: { text },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao analisar");

      const ex: ExtractedData = data.data;
      setExtracted(ex);
      setPatientName(ex.patient_name || "");
      // Default procedure for WhatsApp imports is Rinoplastia
      setProcedure(ex.procedure || "Rinoplastia");
      setHospital(ex.hospital || "");
      setSurgeryDate(toLocalDateTimeInput(ex.surgery_datetime));

      // Try to match doctor by name
      if (ex.doctor_name && isAdmin && professionals.length > 0) {
        const match = professionals.find((p) =>
          p.full_name.toLowerCase().includes(ex.doctor_name!.toLowerCase()) ||
          ex.doctor_name!.toLowerCase().includes(p.full_name.toLowerCase().split(" ")[0])
        );
        if (match) setResponsibleUserId(match.id);
      }

      // Search for existing patient by name
      if (ex.patient_name) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id, name, procedure")
          .ilike("name", `%${ex.patient_name}%`)
          .limit(5);
        if (existing && existing.length > 0) {
          setMatches(existing);
          setSelectedPatientId(existing[0].id);
        }
      }

      toast.success("Dados extraídos! Revise e confirme.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao processar mensagem");
    } finally {
      setParsing(false);
    }
  }

  function handleOpenPreview() {
    if (!user) return;
    if (!patientName.trim() || !procedure.trim() || !surgeryDate) {
      toast.error("Preencha nome do paciente, procedimento e data/hora");
      return;
    }
    const finalResponsibleId = isAdmin ? responsibleUserId : user.id;
    if (!finalResponsibleId) {
      toast.error("Selecione o médico responsável");
      return;
    }

    // Validations
    const warnings: string[] = [];
    const surgery = new Date(surgeryDate);
    if (isNaN(surgery.getTime())) {
      toast.error("Data/hora inválida");
      return;
    }
    if (surgery.getTime() < Date.now()) {
      warnings.push("A data da cirurgia está no passado.");
    }
    const hour = surgery.getHours();
    if (hour < 6 || hour >= 23) {
      warnings.push("Horário fora do expediente típico (06h–23h). Confira se está correto.");
    }
    if (selectedPatientId === "new" && matches.length > 0) {
      warnings.push("Existem pacientes com nome similar. Confirme que deseja criar um novo paciente.");
    }
    setValidationWarnings(warnings);
    setPreviewOpen(true);
  }

  async function handleConfirmSave() {
    if (!user) return;
    const finalResponsibleId = isAdmin ? responsibleUserId : user.id;
    setSaving(true);
    try {
      const utcSurgery = new Date(surgeryDate).toISOString();
      let savedPatientId: string;
      let existingEventId: string | null = null;

      if (selectedPatientId && selectedPatientId !== "new") {
        const { data: existing } = await supabase
          .from("patients")
          .select("google_calendar_event_id")
          .eq("id", selectedPatientId)
          .maybeSingle();
        existingEventId = (existing as any)?.google_calendar_event_id ?? null;

        const { error } = await supabase
          .from("patients")
          .update({
            surgery_date: utcSurgery,
            hospital: hospital || null,
            procedure: procedure,
          })
          .eq("id", selectedPatientId);
        if (error) throw error;
        savedPatientId = selectedPatientId;
        toast.success("Cirurgia agendada para paciente existente!");
      } else {
        const { data, error } = await supabase
          .from("patients")
          .insert([{
            name: patientName.trim(),
            procedure: procedure.trim(),
            hospital: hospital.trim() || null,
            surgery_date: utcSurgery,
            status: "surgery_scheduled" as any,
            responsible_user_id: finalResponsibleId,
            created_by: user.id,
            origem: "whatsapp",
          }])
          .select()
          .single();
        if (error) throw error;
        savedPatientId = data.id;
        toast.success("Paciente criado e cirurgia agendada!");
      }

      // Sync to Google Calendar of the responsible doctor
      try {
        const calAction = existingEventId ? "update" : "create";
        console.log("[ShareCirurgia] Syncing to Google Calendar", {
          calAction,
          patient_id: savedPatientId,
          target_user_id: finalResponsibleId,
        });
        const { data: calResult, error: calError } = await supabase.functions.invoke(
          "google-calendar-create-event",
          {
            body: {
              action: calAction,
              patient_name: patientName.trim(),
              procedure: procedure.trim(),
              hospital: hospital.trim() || null,
              surgery_date: utcSurgery,
              notes: "Importado via WhatsApp",
              patient_id: savedPatientId,
              target_user_id: finalResponsibleId,
              existing_event_id: existingEventId,
            },
          }
        );
        const calRes = calResult as { success?: boolean; connected?: boolean; error?: string } | null;
        if (calError) {
          console.warn("[ShareCirurgia] Google Calendar invoke error:", calError.message);
          toast.warning("Cirurgia salva, mas falhou ao enviar para o Google Agenda.");
        } else if (calRes?.success) {
          toast.success(calAction === "update" ? "Evento atualizado no Google Agenda" : "Evento criado no Google Agenda");
        } else if (calRes?.connected === false) {
          toast.warning("Cirurgia salva, mas o médico não está com Google Agenda conectado.");
        } else if (calRes?.error) {
          toast.warning(`Cirurgia salva, mas Google Agenda falhou: ${calRes.error}`);
        }
      } catch (calErr: any) {
        console.warn("[ShareCirurgia] Google Calendar sync exception", calErr);
        toast.warning("Cirurgia salva, mas houve erro ao sincronizar com o Google Agenda.");
      }

      navigate(`/patients/${savedPatientId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
      setPreviewOpen(false);
    }
  }

  const doctorLabel = (() => {
    const id = isAdmin ? responsibleUserId : user?.id;
    const p = professionals.find((x) => x.id === id);
    return p?.full_name || "—";
  })();

  const isExistingPatient = selectedPatientId && selectedPatientId !== "new";


  const conf = extracted?.confidence;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary">Importar do WhatsApp</h1>
        </div>

        <Card className="p-4 space-y-3">
          <Label htmlFor="raw-text" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Mensagem do WhatsApp
          </Label>
          <Textarea
            id="raw-text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cole aqui a mensagem com os dados da cirurgia..."
            rows={5}
            className="text-sm"
          />
          <Button
            onClick={() => handleParse(rawText)}
            disabled={parsing || !rawText.trim()}
            className="w-full"
            variant="outline"
          >
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {extracted ? "Re-analisar" : "Analisar mensagem"}
              </>
            )}
          </Button>
        </Card>

        {extracted && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Revise os dados antes de confirmar
            </div>

            {matches.length > 0 && (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Select value={selectedPatientId} onValueChange={(v) => {
                  setSelectedPatientId(v);
                  if (v !== "new") {
                    const m = matches.find((x) => x.id === v);
                    if (m) setPatientName(m.name);
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {matches.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {m.procedure}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ Criar novo: {patientName}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Encontramos pacientes com nome parecido. Selecione um existente ou crie novo.
                </p>
              </div>
            )}

            {(matches.length === 0 || selectedPatientId === "new") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="name">Nome do paciente *</Label>
                  {conf && <ConfidenceBadge level={conf.patient_name} />}
                </div>
                <Input id="name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="proc">Procedimento *</Label>
                {conf && <ConfidenceBadge level={conf.procedure} />}
              </div>
              <Input id="proc" value={procedure} onChange={(e) => setProcedure(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="hospital">Hospital</Label>
                {conf && <ConfidenceBadge level={conf.hospital} />}
              </div>
              <Input id="hospital" value={hospital} onChange={(e) => setHospital(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="date">Data e hora *</Label>
                {conf && <ConfidenceBadge level={conf.surgery_datetime} />}
              </div>
              <Input
                id="date"
                type="datetime-local"
                value={surgeryDate}
                onChange={(e) => setSurgeryDate(e.target.value)}
              />
            </div>

            {isAdmin && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Médico responsável *</Label>
                  {conf && <ConfidenceBadge level={conf.doctor_name} />}
                </div>
                <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o médico" /></SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {conf && (conf.surgery_datetime === "low" || conf.patient_name === "low") && (
              <div className="flex gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md text-sm">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span>A IA teve baixa confiança em alguns campos. Confira com cuidado antes de salvar.</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleOpenPreview} disabled={saving} className="flex-1">
                Revisar e agendar
              </Button>
            </div>
          </Card>
        )}

        <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar agendamento</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border p-3 space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Paciente</span>
                      <span className="font-medium text-right">
                        {patientName} {isExistingPatient ? "(existente)" : "(novo)"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Procedimento</span>
                      <span className="font-medium text-right">{procedure}</span>
                    </div>
                    {hospital && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Hospital</span>
                        <span className="font-medium text-right">{hospital}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Data e hora</span>
                      <span className="font-medium text-right">
                        {surgeryDate ? new Date(surgeryDate).toLocaleString("pt-BR", {
                          dateStyle: "full",
                          timeStyle: "short",
                        }) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Médico</span>
                      <span className="font-medium text-right">{doctorLabel}</span>
                    </div>
                  </div>

                  {validationWarnings.length > 0 && (
                    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 space-y-1">
                      {validationWarnings.map((w, i) => (
                        <div key={i} className="flex gap-2">
                          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Voltar e editar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirmSave(); }}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirmar agendamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
