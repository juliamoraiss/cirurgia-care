import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle, Clock, Activity, FileText, StickyNote, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  totalPatients: number;
  scheduledSurgeries: number;
  completedSurgeries: number;
  pendingAuthorization: number;
}

interface Patient {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  insurance: string;
}

interface SystemActivity {
  id: string;
  activity_type: string;
  description: string;
  patient_id: string | null;
  patient_name: string | null;
  created_at: string;
  metadata: any;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    scheduledSurgeries: 0,
    completedSurgeries: 0,
    pendingAuthorization: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [scheduledPatients, setScheduledPatients] = useState<Patient[]>([]);
  const [completedPatients, setCompletedPatients] = useState<Patient[]>([]);
  const [pendingPatients, setPendingPatients] = useState<Patient[]>([]);
  const [activities, setActivities] = useState<SystemActivity[]>([]);

  useEffect(() => {
    async function fetchUserName() {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (data?.full_name) {
          const names = data.full_name.split(" ");
          if (names.length > 1) {
            setUserName(`${names[0]} ${names[names.length - 1]}`);
          } else {
            setUserName(names[0]);
          }
        }
      }
    }

    async function fetchStats() {
      try {
        const now = new Date();

        // Total patients with details
        const { data: allPatientsData, count: totalPatients } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" });

        // Patients with surgery dates
        const { data: patientsWithSurgery } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance")
          .not("surgery_date", "is", null);

        // Filter scheduled (future) and completed (past) surgeries based on date
        const scheduledData: Patient[] = [];
        const completedData: Patient[] = [];

        (patientsWithSurgery || []).forEach((patient) => {
          const surgeryDate = new Date(patient.surgery_date);
          if (surgeryDate > now) {
            scheduledData.push(patient);
          } else {
            completedData.push(patient);
          }
        });

        // Pending authorization
        const { data: pendingData, count: pendingAuthorization } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" })
          .eq("status", "awaiting_authorization");

        setStats({
          totalPatients: totalPatients || 0,
          scheduledSurgeries: scheduledData.length,
          completedSurgeries: completedData.length,
          pendingAuthorization: pendingAuthorization || 0,
        });

        setAllPatients(allPatientsData || []);
        setScheduledPatients(scheduledData);
        setCompletedPatients(completedData);
        setPendingPatients(pendingData || []);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchActivities() {
      try {
        const { data } = await supabase
          .from("system_activities")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        
        setActivities(data || []);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    }

    fetchUserName();
    fetchStats();
    fetchActivities();
  }, [user]);

  const statCards = [
    {
      title: "Total de Pacientes",
      value: stats.totalPatients,
      description: "Pacientes cadastrados",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Cirurgias Agendadas",
      value: stats.scheduledSurgeries,
      description: "Procedimentos confirmados",
      icon: Calendar,
      color: "text-success",
    },
    {
      title: "Cirurgias Realizadas",
      value: stats.completedSurgeries,
      description: "Procedimentos concluídos",
      icon: CheckCircle,
      color: "text-authorized",
    },
    {
      title: "Aguardando Autorização",
      value: stats.pendingAuthorization,
      description: "Pendente do convênio",
      icon: Clock,
      color: "text-warning",
    },
  ];

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Bem-vindo, {userName || "..."}
            </h1>
            <p className="text-muted-foreground">
              Visão geral do sistema de gestão cirúrgica
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => navigate("/patients/new")}>
              Novo Paciente
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            let tooltipContent = null;

            if (stat.title === "Total de Pacientes" && allPatients.length > 0) {
              tooltipContent = (
                <div className="space-y-1">
                  {allPatients.map((patient) => (
                    <div key={patient.id} className="text-sm">
                      {patient.name}
                    </div>
                  ))}
                </div>
              );
            } else if (stat.title === "Cirurgias Agendadas" && scheduledPatients.length > 0) {
              tooltipContent = (
                <div className="space-y-1">
                  {scheduledPatients.map((patient) => (
                    <div key={patient.id} className="text-sm">
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {patient.procedure} - {patient.surgery_date ? new Date(patient.surgery_date).toLocaleDateString('pt-BR') : 'Data não definida'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else if (stat.title === "Cirurgias Realizadas" && completedPatients.length > 0) {
              tooltipContent = (
                <div className="space-y-1">
                  {completedPatients.map((patient) => (
                    <div key={patient.id} className="text-sm">
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {patient.procedure} - {patient.surgery_date ? new Date(patient.surgery_date).toLocaleDateString('pt-BR') : 'Data não definida'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else if (stat.title === "Aguardando Autorização" && pendingPatients.length > 0) {
              tooltipContent = (
                <div className="space-y-1">
                  {pendingPatients.map((patient) => (
                    <div key={patient.id} className="text-sm">
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {patient.insurance || 'Sem convênio'} - {patient.procedure}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <Tooltip key={stat.title}>
                <TooltipTrigger asChild>
                  <Card 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      if (stat.title === "Total de Pacientes") {
                        navigate("/patients");
                      } else if (stat.title === "Cirurgias Agendadas") {
                        navigate("/calendar");
                      } else if (stat.title === "Cirurgias Realizadas") {
                        navigate("/patients", { state: { filterStatus: "completed" } });
                      } else if (stat.title === "Aguardando Autorização") {
                        navigate("/patients", { state: { filterStatus: "awaiting_authorization" } });
                      }
                    }}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {stat.title}
                      </CardTitle>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {loading ? "..." : stat.value}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                {tooltipContent && (
                  <TooltipContent side="bottom" className="max-w-xs max-h-96 overflow-y-auto">
                    {tooltipContent}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Histórico de Atividades</CardTitle>
          </div>
          <CardDescription>
            Últimas atividades realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground text-sm">Carregando histórico...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const getActivityIcon = (type: string) => {
                  switch (type) {
                    case 'patient_created':
                      return <Users className="h-4 w-4 text-primary" />;
                    case 'surgery_scheduled':
                    case 'surgery_rescheduled':
                      return <Calendar className="h-4 w-4 text-success" />;
                    case 'file_uploaded':
                      return <FileText className="h-4 w-4 text-blue-500" />;
                    case 'note_created':
                      return <StickyNote className="h-4 w-4 text-orange-500" />;
                    case 'task_created':
                      return <ClipboardList className="h-4 w-4 text-purple-500" />;
                    default:
                      return <Activity className="h-4 w-4 text-muted-foreground" />;
                  }
                };

                const getActivityDetails = (activity: SystemActivity) => {
                  const metadata = activity.metadata || {};
                  switch (activity.activity_type) {
                    case 'patient_created':
                      return `Procedimento: ${metadata.procedure || 'Não informado'}`;
                    case 'surgery_scheduled':
                      return `${new Date(metadata.surgery_date).toLocaleString('pt-BR')} - ${metadata.hospital || 'Hospital não informado'}`;
                    case 'surgery_rescheduled':
                      return `Nova data: ${new Date(metadata.new_surgery_date).toLocaleString('pt-BR')}`;
                    case 'file_uploaded':
                      return `Arquivo: ${metadata.file_name}`;
                    case 'note_created':
                      return metadata.note_preview;
                    case 'task_created':
                      return `${metadata.task_title} (${metadata.task_type})`;
                    default:
                      return '';
                  }
                };

                return (
                  <div 
                    key={activity.id} 
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (activity.patient_id) {
                        navigate(`/patients/${activity.patient_id}/exams`);
                      }
                    }}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {activity.description}
                          </p>
                          {activity.patient_name && (
                            <p className="text-sm text-primary font-semibold truncate">
                              {activity.patient_name}
                            </p>
                          )}
                          {getActivityDetails(activity) && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {getActivityDetails(activity)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
