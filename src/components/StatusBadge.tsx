import { Badge } from "@/components/ui/badge";

type PatientStatus = 
  | "awaiting_authorization"
  | "authorized"
  | "completed"
  | "cancelled";

interface StatusBadgeProps {
  status: PatientStatus;
}

const statusConfig = {
  awaiting_authorization: {
    label: "Aguardando Autorização",
    variant: "warning" as const,
  },
  authorized: {
    label: "Autorizado",
    variant: "success" as const,
  },
  completed: {
    label: "Cirurgia Realizada",
    variant: "default" as const,
  },
  cancelled: {
    label: "Cirurgia Cancelada",
    variant: "destructive" as const,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
