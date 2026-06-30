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
import { Calendar, MapPin, Plus, History } from "lucide-react";
import { toast } from "sonner";
import { capitalizeFirst } from "@/lib/utils";

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

  const canStartNew = canManage && patientStatus === "completed";

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
      // 1) Archive current surgery snapshot
      const { error: insertError } = await supabase.from("patient_surgeries").insert({
        patient_id: patientId,
        procedure: currentProcedure,
        hospital: currentHospital,
        surgery_date: currentSurgeryDate,
        status: "completed",
        responsible_user_id: currentResponsibleUserId ?? null,
      });
      if (insertError) throw insertError;

      // 2) Reset patient to allow scheduling a new surgery
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
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nova cirurgia
              </Button>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar nova cirurgia?</AlertDialogTitle>
            <AlertDialogDescription>
              A cirurgia atual ({capitalizeFirst(currentProcedure)}) será arquivada no
              histórico e o paciente voltará para “aguardando autorização” para que você
              possa cadastrar a nova cirurgia.
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
