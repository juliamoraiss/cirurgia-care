import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurgeries();
  }, []);

  async function loadSurgeries() {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, procedure, surgery_date, hospital")
        .not("surgery_date", "is", null)
        .order("surgery_date", { ascending: true });

      if (error) throw error;
      setSurgeries(data || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error loading surgeries:", error);
      }
      toast.error("Erro ao carregar cirurgias agendadas");
    } finally {
      setLoading(false);
    }
  }

  const selectedDaySurgeries = surgeries.filter((surgery) =>
    date && isSameDay(new Date(surgery.surgery_date), date)
  );

  const daysWithSurgeries = surgeries.map((surgery) => new Date(surgery.surgery_date));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda de Cirurgias</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os procedimentos agendados
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Calendário
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={ptBR}
                modifiers={{
                  surgery: daysWithSurgeries,
                }}
                modifiersStyles={{
                  surgery: {
                    fontWeight: "bold",
                    textDecoration: "underline",
                  },
                }}
                className="rounded-md border"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Cirurgias em {date ? format(date, "d 'de' MMMM", { locale: ptBR }) : "..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDaySurgeries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma cirurgia agendada para este dia</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDaySurgeries.map((surgery) => (
                  <div
                    key={surgery.id}
                    className="p-4 border rounded-lg bg-muted/50 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold">{surgery.name}</p>
                        <p className="text-sm text-muted-foreground">{surgery.procedure}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(surgery.surgery_date), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {surgery.hospital && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{surgery.hospital}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Calendar;
