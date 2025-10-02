import { Badge } from "@/components/ui/badge";

type PatientStatus = 
  | "awaiting_authorization"
  | "authorized"
  | "pending_scheduling"
  | "surgery_scheduled"
  | "surgery_completed"
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
  pending_scheduling: {
    label: "Pendente de Marcação",
    variant: "pending" as const,
  },
  surgery_scheduled: {
    label: "Cirurgia Marcada",
    variant: "default" as const,
  },
  surgery_completed: {
    label: "Realizado",
    variant: "success" as const,
  },
  cancelled: {
    label: "Cancelado",
    variant: "secondary" as const,
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
