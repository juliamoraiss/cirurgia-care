import { Badge } from "@/components/ui/badge";

type PatientStatus = 
  | "awaiting_consultation"
  | "awaiting_authorization"
  | "authorized"
  | "pending_scheduling"
  | "surgery_scheduled"
  | "surgery_completed"
  | "completed"
  | "cancelled";

interface StatusBadgeProps {
  status: PatientStatus;
}

const statusConfig: Record<PatientStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "pending" }> = {
  awaiting_consultation: {
    label: "Aguardando Consulta",
    variant: "secondary",
  },
  awaiting_authorization: {
    label: "Aguardando Autorização",
    variant: "warning",
  },
  authorized: {
    label: "Autorizado",
    variant: "success",
  },
  pending_scheduling: {
    label: "Ag. Agendamento",
    variant: "pending",
  },
  surgery_scheduled: {
    label: "Cirurgia Agendada",
    variant: "success",
  },
  surgery_completed: {
    label: "Cirurgia Realizada",
    variant: "default",
  },
  completed: {
    label: "Concluído",
    variant: "default",
  },
  cancelled: {
    label: "Cancelado",
    variant: "destructive",
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
