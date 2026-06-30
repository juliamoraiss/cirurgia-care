import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, MapPin, Plus, History, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { capitalizeFirst } from "@/lib/utils";
import { HospitalField } from "@/components/HospitalField";

interface PatientSurgery {
  id: string;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  status: string;
  notes: string | null;
  archived_at: string;
}

interface Props {
  patientId: string;
  patientStatus: string;
  currentProcedure: string;
  currentHospital: string | null;
  currentSurgeryDate: string | null;
  currentResponsibleUserId?: string | null;
  canManage: boolean;
  onArchived?: () => void;
}

const PROCEDURE_OPTIONS = [
  "rinoplastia",
  "septoplastia",
  "rinosseptoplastia",
  "turbinectomia",
  "sinusectomia",
  "adenoidectomia",
  "amigdalectomia",
  "timpanoplastia",
  "mastoidectomia",
  "traqueostomia",
  "troca de cânula",
  "controle",
  "outro",
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "completed", label: "Realizada" },
  { value: "surgery_scheduled", label: "Agendada" },
  { value: "cancelled", label: "Cancelada" },
];

export function PatientSurgeriesHistory({
  patientId,
  patientStatus,
  currentProcedure,
  currentHospital,
  currentSurgeryDate,
  currentResponsibleUserId,
  canManage,
  onArchived,
}: Props) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<PatientSurgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Add to history form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    procedure: "",
    hospital: "",
    surgery_date: "",
    status: "completed",
    notes: "",
  });

  const canStartNew = canManage;

  async function load() {
    const { data, error } = await supabase
      .from("patient_surgeries")
      .select("id, procedure, hospital, surgery_date, status, notes, archived_at")
      .eq("patient_id", patientId)
      .order("archived_at", { ascending: false });
    if (!error) setHistory((data as PatientSurgery[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [patientId]);

  async function handleStartNewSurgery() {
    setArchiving(true);
    try {
      const { error: insertError } = await supabase.from("patient_surgeries").insert({
        patient_id: patientId,
        procedure: currentProcedure,
        hospital: currentHospital,
        surgery_date: currentSurgeryDate,
        status: "completed",
        responsible_user_id: currentResponsibleUserId ?? null,
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("patients")
        .update({
          status: "awaiting_authorization",
          surgery_date: null,
          hospital: null,
          authorization_date: null,
          guide_validity_date: null,
          google_calendar_event_id: null,
        })
        .eq("id", patientId);
      if (updateError) throw updateError;

      toast.success("Cirurgia anterior arquivada. Cadastre a nova cirurgia.");
      setConfirmOpen(false);
      onArchived?.();
      navigate(`/patients/${patientId}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar nova cirurgia");
    } finally {
      setArchiving(false);
    }
  }

  function openForm() {
    setForm({
      procedure: "",
      hospital: "",
      surgery_date: "",
      status: "completed",
      notes: "",
    });
    setFormOpen(true);
  }

  async function handleSaveToHistory() {
    if (!form.procedure.trim()) {
      toast.error("Informe o procedimento");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("patient_surgeries").insert({
        patient_id: patientId,
        procedure: form.procedure.trim().toLowerCase(),
        hospital: form.hospital.trim() || null,
        surgery_date: form.surgery_date ? new Date(form.surgery_date).toISOString() : null,
        status: form.status as any,
        notes: form.notes.trim() || null,
        responsible_user_id: currentResponsibleUserId ?? null,
      });
      if (error) throw error;
      toast.success("Cirurgia adicionada ao histórico");
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar cirurgia");
    } finally {
      setSaving(false);
    }
  }

  if (loading && history.length === 0 && !canStartNew) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Histórico de Cirurgias</CardTitle>
            </div>
            {canStartNew && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={openForm}>
                  <FilePlus className="h-4 w-4 mr-1" />
                  Adicionar ao histórico
                </Button>
                <Button size="sm" onClick={() => setConfirmOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova cirurgia
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            {history.length === 0
              ? "Nenhuma cirurgia anterior registrada"
              : `${history.length} cirurgia(s) anterior(es)`}
          </CardDescription>
        </CardHeader>
        {history.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {history.map((s) => (
                <div key={s.id} className="p-3 border rounded-lg bg-muted/30">
                  <div className="font-medium">{capitalizeFirst(s.procedure)}</div>
                  <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {s.surgery_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(s.surgery_date).toLocaleString("pt-BR")}
                      </span>
                    )}
                    {s.hospital && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {s.hospital}
                      </span>
                    )}
                  </div>
                  {s.notes && (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {s.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add to history form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar cirurgia ao histórico</DialogTitle>
            <DialogDescription>
              Cadastre uma cirurgia diretamente no histórico do paciente, sem alterar a
              cirurgia atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Procedimento *</Label>
              <Select
                value={form.procedure}
                onValueChange={(v) => setForm((f) => ({ ...f, procedure: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {PROCEDURE_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {capitalizeFirst(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <HospitalField
                value={form.hospital}
                onChange={(v) => setForm((f) => ({ ...f, hospital: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data da cirurgia</Label>
              <Input
                type="datetime-local"
                value={form.surgery_date}
                onChange={(e) => setForm((f) => ({ ...f, surgery_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observações sobre esta cirurgia (opcional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveToHistory} disabled={saving}>
              {saving ? "Salvando..." : "Salvar no histórico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace-current confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir cirurgia atual?</AlertDialogTitle>
            <AlertDialogDescription>
              A cirurgia atual ({capitalizeFirst(currentProcedure)}) será arquivada no
              histórico e o paciente voltará para “aguardando autorização” para que você
              cadastre a nova cirurgia ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartNewSurgery} disabled={archiving}>
              {archiving ? "Arquivando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
