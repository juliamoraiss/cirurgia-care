import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

interface UpcomingSurgeriesProps {
  surgeries: Surgery[];
  loading: boolean;
}

export function UpcomingSurgeries({ surgeries, loading }: UpcomingSurgeriesProps) {
  const navigate = useNavigate();

  // Get surgeries for today and tomorrow
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const urgentSurgeries = surgeries.filter((surgery) => {
    const surgeryDate = new Date(surgery.surgery_date);
    return surgeryDate <= tomorrow;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle>Próximas Cirurgias</CardTitle>
          </div>
          <CardDescription>Cirurgias agendadas para hoje e amanhã</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (urgentSurgeries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle>Próximas Cirurgias</CardTitle>
          </div>
          <CardDescription>Cirurgias agendadas para hoje e amanhã</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhuma cirurgia urgente agendada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-success" />
          <CardTitle>Próximas Cirurgias</CardTitle>
        </div>
        <CardDescription>
          {urgentSurgeries.length} {urgentSurgeries.length === 1 ? 'cirurgia agendada' : 'cirurgias agendadas'} para hoje/amanhã
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {urgentSurgeries.map((surgery) => (
            <div
              key={surgery.id}
              onClick={() => navigate(`/patients/${surgery.id}/exams`)}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-foreground">{surgery.name}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(surgery.surgery_date), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{surgery.procedure}</p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(surgery.surgery_date).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
                {surgery.hospital && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{surgery.hospital}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
