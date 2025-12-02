import { Bell, Building2, Users, Calendar, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickIndicatorsProps {
  monthlySurgeries: number;
  activePatients: number;
  pendingTasks: number;
  totalPatients: number;
  scheduledSurgeries: number;
  completedSurgeries: number;
  pendingAuthorization: number;
  loading: boolean;
}

export const QuickIndicators = ({
  monthlySurgeries,
  activePatients,
  pendingTasks,
  totalPatients,
  scheduledSurgeries,
  completedSurgeries,
  pendingAuthorization,
  loading,
}: QuickIndicatorsProps) => {
  const navigate = useNavigate();

  const indicators = [
    {
      icon: Bell,
      value: pendingTasks,
      label: "pendências",
      bgColor: "bg-warning-light",
      textColor: "text-warning",
      borderColor: "border-warning/20",
      onClick: () => navigate("/tasks"),
    },
    {
      icon: Building2,
      value: monthlySurgeries,
      label: "cirurgias no mês",
      bgColor: "bg-success-light",
      textColor: "text-success",
      borderColor: "border-success/20",
      onClick: () => navigate("/calendar"),
    },
    {
      icon: Users,
      value: totalPatients,
      label: "pacientes",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      borderColor: "border-primary/20",
      onClick: () => navigate("/patients"),
    },
    {
      icon: Calendar,
      value: scheduledSurgeries,
      label: "agendadas",
      bgColor: "bg-success-light",
      textColor: "text-success",
      borderColor: "border-success/20",
      onClick: () => navigate("/calendar"),
    },
    {
      icon: CheckCircle,
      value: completedSurgeries,
      label: "realizadas",
      bgColor: "bg-authorized/10",
      textColor: "text-authorized",
      borderColor: "border-authorized/20",
      onClick: () => navigate("/patients", { state: { filterStatus: "completed" } }),
    },
    {
      icon: Clock,
      value: pendingAuthorization,
      label: "aguardando",
      bgColor: "bg-warning-light",
      textColor: "text-warning",
      borderColor: "border-warning/20",
      onClick: () => navigate("/patients", { state: { filterStatus: "awaiting_authorization" } }),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-9 w-28 bg-muted animate-pulse rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {indicators.map((indicator) => {
        const Icon = indicator.icon;
        return (
          <button
            key={indicator.label}
            onClick={indicator.onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${indicator.bgColor} ${indicator.borderColor} transition-all hover:scale-105 active:scale-95`}
          >
            <Icon className={`h-3.5 w-3.5 ${indicator.textColor}`} />
            <span className={`font-bold text-sm ${indicator.textColor}`}>
              {indicator.value}
            </span>
            <span className="text-xs text-muted-foreground">
              {indicator.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
