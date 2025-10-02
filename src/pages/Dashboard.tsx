import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalPatients: number;
  scheduledSurgeries: number;
  completedSurgeries: number;
  pendingAuthorization: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    scheduledSurgeries: 0,
    completedSurgeries: 0,
    pendingAuthorization: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Total patients
        const { count: totalPatients } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true });

        // Scheduled surgeries
        const { count: scheduledSurgeries } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("status", "surgery_scheduled");

        // Completed surgeries
        const { count: completedSurgeries } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("status", "surgery_completed");

        // Pending authorization
        const { count: pendingAuthorization } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("status", "awaiting_authorization");

        setStats({
          totalPatients: totalPatients || 0,
          scheduledSurgeries: scheduledSurgeries || 0,
          completedSurgeries: completedSurgeries || 0,
          pendingAuthorization: pendingAuthorization || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
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
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
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
              Histórico completo de alterações
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
  );
};

export default Dashboard;
