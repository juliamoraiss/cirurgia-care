import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, MapPin, User, Activity, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/StatusBadge";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
  status?: string;
}

interface NextSurgeryHighlightProps {
  surgery: Surgery | null;
  loading: boolean;
}

export function NextSurgeryHighlight({ surgery, loading }: NextSurgeryHighlightProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/30">
        <CardContent className="p-card">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success mx-auto"></div>
            <p className="mt-4 text-muted-foreground text-small">Carregando...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!surgery) {
    return (
      <Card className="bg-gradient-to-br from-muted/30 to-transparent border-muted">
        <CardContent className="p-card">
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-small font-medium">Nenhuma cirurgia urgente agendada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Você está em dia!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const surgeryDate = new Date(surgery.surgery_date);
  const isTodaySurgery = isToday(surgeryDate);
  const isTomorrowSurgery = isTomorrow(surgeryDate);
  const isUrgent = isTodaySurgery || isTomorrowSurgery;

  const getUrgencyLabel = () => {
    if (isTodaySurgery) return "HOJE";
    if (isTomorrowSurgery) return "AMANHÃ";
    return null;
  };

  const urgencyLabel = getUrgencyLabel();

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isTodaySurgery 
          ? 'bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent border-destructive/40 shadow-md' 
          : isTomorrowSurgery
          ? 'bg-gradient-to-br from-warning/15 via-warning/5 to-transparent border-warning/40'
          : 'bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/30'
      }`}
      onClick={() => navigate(`/patients/${surgery.id}/exams`)}
    >
      <CardContent className="p-card md:p-[1.25rem]">
        <div className="space-y-compact">
          {/* Header */}
          <div className="flex items-start justify-between gap-compact">
            <div className="flex items-start gap-element flex-1">
              {isUrgent && (
                <AlertCircle 
                  className={`h-5 w-5 shrink-0 mt-0.5 ${
                    isTodaySurgery ? 'text-destructive animate-pulse' : 'text-warning'
                  }`} 
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-element mb-1">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/70">
                    🟦 Próxima Cirurgia
                  </h3>
                  {urgencyLabel && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isTodaySurgery 
                        ? 'bg-destructive/20 text-destructive' 
                        : 'bg-warning/20 text-warning'
                    }`}>
                      {urgencyLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {surgery.status && (
              <StatusBadge status={surgery.status as any} />
            )}
          </div>

          {/* Patient Info */}
          <div className="space-y-compact">
            <div className="flex items-center gap-element">
              <User className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-small text-muted-foreground/70">Paciente</p>
                <p className="text-subtitle font-bold text-foreground truncate">{surgery.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-compact">
              <div className="flex items-center gap-element">
                <Activity className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground/70">Procedimento</p>
                  <p className="text-small font-semibold text-foreground capitalize truncate">
                    {surgery.procedure}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-element">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground/70">Horário</p>
                  <p className={`text-small font-semibold truncate ${
                    isUrgent ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {format(surgeryDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            {surgery.hospital && (
              <div className="flex items-center gap-element">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground/70">Hospital</p>
                  <p className="text-small font-semibold text-foreground truncate">
                    {surgery.hospital}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
