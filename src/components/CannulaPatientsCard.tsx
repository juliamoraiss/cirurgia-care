import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { RefreshCw, User, Clock, CheckCircle2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CannulaPatient {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string | null;
  status: string;
  hospital: string | null;
  responsible_user_id: string;
}

interface CannulaTask {
  id: string;
  patient_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
}

interface CannulaPatientsCardProps {
  selectedProfessional: string;
  isAdmin: boolean;
}

export function CannulaPatientsCard({ selectedProfessional, isAdmin }: CannulaPatientsCardProps) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<CannulaPatient[]>([]);
  const [tasks, setTasks] = useState<CannulaTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        let query = supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, status, hospital, responsible_user_id")
          .ilike("procedure", "%troca de c_nula%")
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false });

        if (isAdmin && selectedProfessional !== "all") {
          query = query.eq("responsible_user_id", selectedProfessional);
        }

        const { data: patientsData } = await query;
        setPatients(patientsData || []);

        if (patientsData && patientsData.length > 0) {
          const patientIds = patientsData.map(p => p.id);
          const { data: tasksData } = await supabase
            .from("patient_tasks")
            .select("id, patient_id, title, due_date, completed, completed_at")
            .in("patient_id", patientIds)
            .ilike("title", "%cânula%")
            .order("due_date", { ascending: true });

          setTasks(tasksData || []);
        }
      } catch (error) {
        console.error("Error fetching cannula patients:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedProfessional, isAdmin]);

  if (!loading && patients.length === 0) return null;

  const getNextTask = (patientId: string) => {
    return tasks.find(t => t.patient_id === patientId && !t.completed);
  };

  const getLastCompleted = (patientId: string) => {
    const completed = tasks
      .filter(t => t.patient_id === patientId && t.completed && t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    return completed[0];
  };

  return (
    <CollapsibleCard
      icon={RefreshCw}
      title="Troca de Cânula"
      defaultOpen={true}
      headerRight={
        <Badge variant="secondary" className="text-xs">
          {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
        </Badge>
      }
    >
      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-muted-foreground text-sm">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(patient => {
            const nextTask = getNextTask(patient.id);
            const lastCompleted = getLastCompleted(patient.id);
            const isOverdue = nextTask && new Date(nextTask.due_date) < new Date();

            return (
              <div
                key={patient.id}
                onClick={() => navigate(`/patients/${patient.id}`)}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                  isOverdue ? "border-destructive/50 bg-destructive/5" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{patient.name}</span>
                  </div>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      Atrasado
                    </Badge>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {nextTask && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Próxima troca: {format(new Date(nextTask.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        {" "}({formatDistanceToNow(new Date(nextTask.due_date), { addSuffix: true, locale: ptBR })})
                      </span>
                    </div>
                  )}
                  {lastCompleted && lastCompleted.completed_at && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Última troca: {format(new Date(lastCompleted.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {!nextTask && !lastCompleted && (
                    <span className="text-muted-foreground/70">Sem tarefas de troca registradas</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
}
