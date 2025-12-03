import { Calendar, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickIndicatorsProps {
  scheduledSurgeries: number;
  completedSurgeries: number;
  pendingAuthorization: number;
  loading: boolean;
}

export const QuickIndicators = ({
  scheduledSurgeries,
  completedSurgeries,
  pendingAuthorization,
  loading,
}: QuickIndicatorsProps) => {
  const navigate = useNavigate();

  const indicators = [
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
      icon: Calendar,
      value: scheduledSurgeries,
      label: "agendadas",
      bgColor: "bg-success-light",
      textColor: "text-success",
      borderColor: "border-success/20",
      onClick: () => navigate("/calendar"),
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
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 flex-1 bg-muted animate-pulse rounded-xl"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {indicators.map((indicator) => {
        const Icon = indicator.icon;
        return (
          <button
            key={indicator.label}
            onClick={indicator.onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-xl border ${indicator.bgColor} ${indicator.borderColor} transition-all hover:scale-[1.02] active:scale-95`}
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`h-4 w-4 ${indicator.textColor}`} />
              <span className={`font-bold text-lg ${indicator.textColor}`}>
                {indicator.value}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {indicator.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};