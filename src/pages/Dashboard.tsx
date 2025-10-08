import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        // Total patients with details
        const { data: allPatientsData, count: totalPatients } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" });

        // Scheduled surgeries
        const { data: scheduledData, count: scheduledSurgeries } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" })
          .eq("status", "surgery_scheduled");

        // Completed surgeries
        const { data: completedData, count: completedSurgeries } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" })
          .eq("status", "surgery_completed");

        // Pending authorization
        const { data: pendingData, count: pendingAuthorization } = await supabase
          .from("patients")
          .select("id, name, procedure, surgery_date, insurance", { count: "exact" })
          .eq("status", "awaiting_authorization");

        setStats({
          totalPatients: totalPatients || 0,
          scheduledSurgeries: scheduledSurgeries || 0,
          completedSurgeries: completedSurgeries || 0,
          pendingAuthorization: pendingAuthorization || 0,
        });

        setAllPatients(allPatientsData || []);
        setScheduledPatients(scheduledData || []);
        setCompletedPatients(completedData || []);
        setPendingPatients(pendingData || []);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserName();
    fetchStats();
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
          <Button onClick={() => navigate("/patients/new")}>
            Novo Paciente
          </Button>
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
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          <CardTitle>Bem-vindo ao MedSystem</CardTitle>
          <CardDescription>
            Sistema profissional de gestão de cirurgias e pacientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gerencie todo o ciclo cirúrgico dos seus pacientes de forma eficiente:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-success" />
              Acompanhe autorizações do convênio
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-success" />
              Gerencie agendamentos de cirurgias
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-success" />
              Controle checklists de exames
            </li>
            <li className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-success" />
              Calendário de cirurgias
            </li>
          </ul>
          <div className="pt-4">
            <Button onClick={() => navigate("/patients")}>
              Ver Todos os Pacientes
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
