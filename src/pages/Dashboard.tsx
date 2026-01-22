import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle, Clock, Activity, FileText, StickyNote, ClipboardList, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PendingPatients } from "@/components/PendingPatients";
import { SurgeriesCard } from "@/components/SurgeriesCard";
import { QuickIndicators } from "@/components/QuickIndicators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfessionals } from "@/hooks/useProfessionals";

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
  hospital: string | null;
  status?: string;
  responsible_user_id?: string;
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
  const {
    user
  } = useAuth();
  const {
    isAdmin
  } = useUserRole();
  const { professionals } = useProfessionals();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    scheduledSurgeries: 0,
    completedSurgeries: 0,
    pendingAuthorization: 0
  });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [scheduledPatients, setScheduledPatients] = useState<Patient[]>([]);
  const [completedPatients, setCompletedPatients] = useState<Patient[]>([]);
  const [pendingPatients, setPendingPatients] = useState<Patient[]>([]);
  const [activities, setActivities] = useState<SystemActivity[]>([]);
  const [monthlySurgeries, setMonthlySurgeries] = useState(0);
  const [activePatients, setActivePatients] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  useEffect(() => {
    async function fetchUserName() {
      if (user) {
        const {
          data
        } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
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
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // Total patients with details
        const {
          data: allPatientsData,
          count: totalPatients
        } = await supabase.from("patients").select("id, name, procedure, surgery_date, insurance, hospital, status, responsible_user_id", {
          count: "exact"
        });

        // Patients with surgery dates
        const {
          data: patientsWithSurgery
        } = await supabase.from("patients").select("id, name, procedure, surgery_date, insurance, hospital, status, responsible_user_id").not("surgery_date", "is", null).order("surgery_date", {
          ascending: true
        });

        // Filter scheduled (future) and completed (past) surgeries based on date
        const scheduledData: Patient[] = [];
        const completedData: Patient[] = [];
        (patientsWithSurgery || []).forEach(patient => {
          const surgeryDate = new Date(patient.surgery_date);
          if (surgeryDate > now) {
            scheduledData.push(patient);
          } else {
            completedData.push(patient);
          }
        });

        // Pending authorization
        const {
          data: pendingData,
          count: pendingAuthorization
        } = await supabase.from("patients").select("id, name, procedure, surgery_date, insurance, hospital", {
          count: "exact"
        }).eq("status", "awaiting_authorization");

        // Monthly surgeries count
        const {
          count: monthlyCount
        } = await supabase.from("patients").select("id", {
          count: "exact"
        }).not("surgery_date", "is", null).gte("surgery_date", monthStart.toISOString()).lte("surgery_date", monthEnd.toISOString());

        // Active patients (not completed or cancelled)
        const {
          count: activeCount
        } = await supabase.from("patients").select("id", {
          count: "exact"
        }).not("status", "in", '("completed","cancelled","surgery_completed")');

        // Pending tasks
        const {
          count: tasksCount
        } = await supabase.from("patient_tasks").select("id", {
          count: "exact"
        }).eq("completed", false);
        setStats({
          totalPatients: totalPatients || 0,
          scheduledSurgeries: scheduledData.length,
          completedSurgeries: completedData.length,
          pendingAuthorization: pendingAuthorization || 0
        });
        setMonthlySurgeries(monthlyCount || 0);
        setActivePatients(activeCount || 0);
        setPendingTasks(tasksCount || 0);
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
        const {
          data
        } = await supabase.from("system_activities").select("*").neq("activity_type", "patient_created").order("created_at", {
          ascending: false
        }).limit(10);
        setActivities(data || []);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    }
    fetchUserName();
    fetchStats();
    fetchActivities();
  }, [user]);
  const deleteActivity = async (activityId: string) => {
    try {
      const {
        error
      } = await supabase.from("system_activities").delete().eq("id", activityId);
      if (error) throw error;
      setActivities(prev => prev.filter(activity => activity.id !== activityId));
      toast.success("Registro excluído com sucesso");
    } catch (error) {
      toast.error("Erro ao excluir registro");
      console.error("Error deleting activity:", error);
    }
  };
  // Filter patients based on selected professional
  const filterByProfessional = (patients: Patient[]) => {
    if (!isAdmin || selectedProfessional === "all") return patients;
    return patients.filter(p => p.responsible_user_id === selectedProfessional);
  };

  const filteredScheduledPatients = filterByProfessional(scheduledPatients);
  const filteredPendingPatients = filterByProfessional(pendingPatients);
  
  // Filter activities based on selected professional
  const filteredActivities = (() => {
    if (!isAdmin || selectedProfessional === "all") return activities;
    
    // Get patient IDs for the selected professional
    const professionalPatientIds = allPatients
      .filter(p => p.responsible_user_id === selectedProfessional)
      .map(p => p.id);
    
    // Filter activities that belong to the selected professional's patients
    return activities.filter(activity => 
      activity.patient_id === null || professionalPatientIds.includes(activity.patient_id)
    );
  })();

  const getProfessionalName = (id: string) => {
    const prof = professionals.find(p => p.id === id);
    return prof?.full_name || "Não atribuído";
  };

  return <TooltipProvider>
      <div className="p-4 md:p-6 space-y-6 md:space-y-8 pb-24">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="md:text-4xl font-bold text-foreground tracking-tight text-2xl">
                Bem-vindo, {userName || "..."}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground/50 mt-1">
                Visão geral do sistema de gestão
              </p>
            </div>
            
            {/* Professional filter for admins */}
            {isAdmin && professionals.length > 0 && (
              <div className="w-full md:w-64">
                <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os profissionais</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.full_name} ({prof.user_type === "dentista" ? "Dentista" : "Médico"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {/* Quick Indicators */}
          <QuickIndicators scheduledSurgeries={filteredScheduledPatients.length} completedSurgeries={stats.completedSurgeries} pendingAuthorization={filteredPendingPatients.length} loading={loading} />
        </div>

        {/* Priority sections for mobile - show urgent info first */}
        <div className="grid gap-4 md:grid-cols-2">
          <SurgeriesCard surgeries={filteredScheduledPatients} loading={loading} />
          <PendingPatients patients={filteredPendingPatients} loading={loading} />
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
          {loading ? <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground text-sm">Carregando histórico...</p>
            </div> : filteredActivities.length === 0 ? <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda</p>
            </div> : <div className="space-y-4">
              {filteredActivities.map(activity => {
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
                  case 'hospital_updated':
                    return <Activity className="h-4 w-4 text-cyan-500" />;
                  case 'status_updated':
                    return <CheckCircle className="h-4 w-4 text-amber-500" />;
                  case 'procedure_updated':
                    return <Activity className="h-4 w-4 text-indigo-500" />;
                  default:
                    return <Activity className="h-4 w-4 text-muted-foreground" />;
                }
              };
              const translateStatus = (status: string) => {
                const statusMap: Record<string, string> = {
                  'awaiting_consultation': 'Aguardando Consulta',
                  'awaiting_authorization': 'Aguardando Autorização',
                  'authorized': 'Autorizado',
                  'pending_scheduling': 'Agendamento Pendente',
                  'surgery_scheduled': 'Cirurgia Agendada',
                  'surgery_completed': 'Cirurgia Realizada',
                  'completed': 'Cirurgia Realizada',
                  'cancelled': 'Cancelado',
                };
                return statusMap[status] || status;
              };

              const translateTaskType = (type: string) => {
                const taskTypeMap: Record<string, string> = {
                  'exam_collection': 'Cobrança de Exame',
                  'follow_up': 'Acompanhamento',
                  'document_request': 'Solicitação de Documento',
                  'authorization_follow_up': 'Acompanhamento de Autorização',
                  'surgery_confirmation': 'Confirmação de Cirurgia',
                  'post_surgery_follow_up': 'Acompanhamento Pós-Cirurgia',
                  'other': 'Outro',
                };
                return taskTypeMap[type] || type;
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
                    return metadata.task_title;
                  case 'hospital_updated':
                    return `${metadata.old_hospital || 'Nenhum'} → ${metadata.new_hospital}`;
                  case 'status_updated':
                    return `${translateStatus(metadata.old_status)} → ${translateStatus(metadata.new_status)}`;
                  case 'procedure_updated':
                    return `${metadata.old_procedure} → ${metadata.new_procedure}`;
                  default:
                    return '';
                }
              };
              return <div key={activity.id} className="flex gap-2 p-2.5 md:p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
                    <div className="flex-1 min-w-0 cursor-pointer flex gap-2" onClick={() => {
                  if (activity.patient_id) {
                    navigate(`/patients/${activity.patient_id}/exams`);
                  }
                }}>
                      <div className="flex-shrink-0 mt-0.5">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium line-clamp-2">
                              {activity.description}
                            </p>
                            {activity.patient_name && <p className="text-xs md:text-sm text-primary font-semibold truncate mt-0.5">
                                {activity.patient_name}
                              </p>}
                            {getActivityDetails(activity) && <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {getActivityDetails(activity)}
                              </p>}
                          </div>
                          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 p-0" onClick={e => {
                  e.stopPropagation();
                  deleteActivity(activity.id);
                }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>}
                  </div>;
            })}
            </div>}
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>;
};
export default Dashboard;