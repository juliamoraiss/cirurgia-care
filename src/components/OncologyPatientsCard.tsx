import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Calendar, ChevronRight, Stethoscope } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OncologyPatient {
  id: string;
  name: string;
  procedure: string;
  status: string;
  surgery_date: string | null;
  oncology_stage: string | null;
  responsible_user_id: string;
  last_event?: {
    title: string;
    event_date: string;
    event_type: string;
  } | null;
}

interface OncologyPatientsCardProps {
  selectedProfessional?: string;
  isAdmin?: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "pending" }> = {
  awaiting_consultation: { label: "Aguardando Consulta", variant: "secondary" },
  awaiting_authorization: { label: "Aguardando Autorização", variant: "warning" },
  authorized: { label: "Autorizado", variant: "success" },
  pending_scheduling: { label: "Agendamento Pendente", variant: "pending" },
  surgery_scheduled: { label: "Cirurgia Agendada", variant: "success" },
  surgery_completed: { label: "Cirurgia Realizada", variant: "default" },
  completed: { label: "Concluído", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function OncologyPatientsCard({ selectedProfessional, isAdmin }: OncologyPatientsCardProps) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<OncologyPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOncologyPatients();
  }, [selectedProfessional]);

  async function loadOncologyPatients() {
    try {
      // Buscar pacientes oncológicos
      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, procedure, status, surgery_date, oncology_stage, responsible_user_id")
        .eq("is_oncology", true)
        .not("status", "in", '("cancelled","completed")')
        .order("created_at", { ascending: false });

      if (patientsError) throw patientsError;

      // Filtrar por profissional se necessário
      let filteredPatients = patientsData || [];
      if (isAdmin && selectedProfessional && selectedProfessional !== "all") {
        filteredPatients = filteredPatients.filter(p => p.responsible_user_id === selectedProfessional);
      }

      // Buscar último evento de cada paciente
      const patientsWithEvents: OncologyPatient[] = await Promise.all(
        filteredPatients.map(async (patient) => {
          const { data: eventData } = await supabase
            .from("oncology_timeline")
            .select("title, event_date, event_type")
            .eq("patient_id", patient.id)
            .order("event_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...patient,
            last_event: eventData,
          };
        })
      );

      setPatients(patientsWithEvents);
    } catch (error) {
      console.error("Error loading oncology patients:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Pacientes Oncológicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle>Pacientes Oncológicos</CardTitle>
        </div>
        <CardDescription>
          {patients.length === 0
            ? "Nenhum paciente oncológico ativo"
            : `${patients.length} paciente(s) em acompanhamento`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <div className="text-center py-8">
            <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">
              Nenhum paciente oncológico ativo no momento
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Marque pacientes como oncológicos no cadastro
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.slice(0, 5).map((patient) => {
              const statusInfo = statusConfig[patient.status] || { label: patient.status, variant: "secondary" as const };
              
              return (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/patients/${patient.id}/exams`)}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm truncate">{patient.name}</h4>
                      <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0">
                        {statusInfo.label}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {patient.procedure}
                      {patient.oncology_stage && ` • Estágio: ${patient.oncology_stage}`}
                    </p>
                    
                    {patient.last_event && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          Último evento: {patient.last_event.title} -{" "}
                          {formatDistanceToNow(new Date(patient.last_event.event_date), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              );
            })}
            
            {patients.length > 5 && (
              <button
                onClick={() => navigate("/patients", { state: { filterOncology: true } })}
                className="w-full text-center text-sm text-primary hover:underline py-2"
              >
                Ver todos ({patients.length})
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
