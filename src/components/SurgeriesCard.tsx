import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isToday, isTomorrow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}
interface SurgeriesCardProps {
  surgeries: Surgery[];
  loading: boolean;
}
export function SurgeriesCard({
  surgeries,
  loading
}: SurgeriesCardProps) {
  const navigate = useNavigate();

  // Filter surgeries for the next 7 days
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  sevenDaysFromNow.setHours(23, 59, 59, 999);
  const upcomingSurgeries = surgeries.filter(surgery => {
    const surgeryDate = new Date(surgery.surgery_date);
    return surgeryDate <= sevenDaysFromNow;
  });
  if (loading) {
    return <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle className="text-base">Próximas Cirurgias</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
          </div>
        </CardContent>
      </Card>;
  }
  if (upcomingSurgeries.length === 0) {
    return <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle className="text-base">Próximas Cirurgias</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-xs">Nenhuma cirurgia agendada para os pr</p>
            <p className="text-xs text-muted-foreground/60">Você está em dia!</p>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-success" />
            <CardTitle className="text-base">Próximas Cirurgias</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {upcomingSurgeries.length} {upcomingSurgeries.length === 1 ? 'agendada' : 'agendadas'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {upcomingSurgeries.map((surgery, index) => {
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
          return <button key={surgery.id} onClick={() => navigate(`/patients/${surgery.id}/exams`)} className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md active:scale-[0.98] ${isTodaySurgery ? 'bg-destructive/10 border-destructive/30' : isTomorrowSurgery ? 'bg-warning/10 border-warning/30' : 'bg-muted/50 border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isUrgent && <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${isTodaySurgery ? 'text-destructive' : 'text-warning'}`} />}
                      <span className="font-semibold text-sm text-foreground truncate">
                        {surgery.name}
                      </span>
                      {urgencyLabel && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isTodaySurgery ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'}`}>
                          {urgencyLabel}
                        </span>}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {surgery.procedure}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{format(surgeryDate, "dd/MM 'às' HH:mm", {
                    locale: ptBR
                  })}</span>
                  </div>
                  {surgery.hospital && <div className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{surgery.hospital}</span>
                    </div>}
                </div>
              </button>;
        })}
        </div>
      </CardContent>
    </Card>;
}