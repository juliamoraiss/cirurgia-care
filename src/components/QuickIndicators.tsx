import { Bell, Building2, Users } from "lucide-react";

interface QuickIndicatorsProps {
  monthlySurgeries: number;
  activePatients: number;
  pendingTasks: number;
  loading: boolean;
}

export const QuickIndicators = ({
  monthlySurgeries,
  activePatients,
  pendingTasks,
  loading,
}: QuickIndicatorsProps) => {
  const indicators = [
    {
      icon: Bell,
      value: pendingTasks,
      label: "pendências",
      bgColor: "bg-warning-light",
      textColor: "text-warning",
      borderColor: "border-warning/20",
    },
    {
      icon: Building2,
      value: monthlySurgeries,
      label: "cirurgias no mês",
      bgColor: "bg-success-light",
      textColor: "text-success",
      borderColor: "border-success/20",
    },
    {
      icon: Users,
      value: activePatients,
      label: "pacientes ativos",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      borderColor: "border-primary/20",
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 md:gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-36 bg-muted animate-pulse rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 md:gap-3">
      {indicators.map((indicator) => {
        const Icon = indicator.icon;
        return (
          <div
            key={indicator.label}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${indicator.bgColor} ${indicator.borderColor} transition-transform hover:scale-105`}
          >
            <Icon className={`h-4 w-4 ${indicator.textColor}`} />
            <span className={`font-bold ${indicator.textColor}`}>
              {indicator.value}
            </span>
            <span className="text-sm text-muted-foreground">
              {indicator.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
