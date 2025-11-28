import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StandardCard, CardInfo } from "@/components/StandardCard";

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
          <div className="flex items-center gap-element">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle className="text-subtitle">Próximas Cirurgias</CardTitle>
          </div>
          <CardDescription className="text-small">Cirurgias agendadas para hoje e amanhã</CardDescription>
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
          <div className="flex items-center gap-element">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle className="text-subtitle">Próximas Cirurgias</CardTitle>
          </div>
          <CardDescription className="text-small">Cirurgias agendadas para hoje e amanhã</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-small">Nenhuma cirurgia urgente agendada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-element">
          <Calendar className="h-5 w-5 text-success" />
          <CardTitle className="text-subtitle">Próximas Cirurgias</CardTitle>
        </div>
        <CardDescription className="text-small">
          {urgentSurgeries.length} {urgentSurgeries.length === 1 ? 'cirurgia agendada' : 'cirurgias agendadas'} para hoje/amanhã
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-compact">
          {urgentSurgeries.map((surgery) => {
            const surgeryDate = new Date(surgery.surgery_date);
            const isTodaySurgery = isToday(surgeryDate);
            
            const infos: CardInfo[] = [
              {
                icon: Clock,
                label: "Data",
                value: surgeryDate.toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                highlighted: isTodaySurgery,
              },
            ];

            if (surgery.hospital) {
              infos.push({
                icon: MapPin,
                label: "Hospital",
                value: surgery.hospital,
              });
            }
            
            return (
              <StandardCard
                key={surgery.id}
                title={surgery.name}
                subtitle={surgery.procedure}
                infos={infos}
                highlighted={isTodaySurgery}
                actionLabel="Ver detalhes"
                onAction={() => navigate(`/patients/${surgery.id}/exams`)}
                onClick={() => navigate(`/patients/${surgery.id}/exams`)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
