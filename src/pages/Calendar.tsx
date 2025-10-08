import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
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
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDaySurgeries, setSelectedDaySurgeries] = useState<Surgery[]>([]);

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
      toast.error("Erro ao carregar cirurgias agendadas");
    } finally {
      setLoading(false);
    }
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSurgeriesForDay = (day: Date) => {
    return surgeries
      .filter((surgery) => isSameDay(new Date(surgery.surgery_date), day))
      .sort((a, b) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime());
  };

  const getColorForIndex = (index: number) => {
    const colors = [
      "bg-blue-100 border-blue-500 text-blue-900",
      "bg-green-100 border-green-500 text-green-900",
      "bg-purple-100 border-purple-500 text-purple-900",
      "bg-orange-100 border-orange-500 text-orange-900",
      "bg-pink-100 border-pink-500 text-pink-900",
      "bg-cyan-100 border-cyan-500 text-cyan-900",
    ];
    return colors[index % colors.length];
  };

  const handleDayClick = (day: Date, daySurgeries: Surgery[]) => {
    if (daySurgeries.length > 0) {
      setSelectedDay(day);
      setSelectedDaySurgeries(daySurgeries);
    }
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda de Cirurgias</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os procedimentos agendados
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2 text-muted-foreground">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const daySurgeries = getSurgeriesForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day, daySurgeries)}
                    className={`min-h-[120px] border rounded-lg p-2 ${
                      isCurrentMonth ? "bg-background" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-primary" : ""} ${
                      daySurgeries.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {daySurgeries.map((surgery, surgeryIndex) => (
                        <div
                          key={surgery.id}
                          className={`text-xs p-1.5 rounded border-l-2 space-y-0.5 ${
                            daySurgeries.length > 1 
                              ? getColorForIndex(surgeryIndex)
                              : "bg-primary/10 border-primary text-primary"
                          }`}
                        >
                          <div className="font-semibold">
                            {format(new Date(surgery.surgery_date), "HH:mm")}
                          </div>
                          <div className="font-medium truncate" title={surgery.name}>
                            {surgery.name}
                          </div>
                          <div className="truncate opacity-80" title={surgery.hospital || 'Hospital não informado'}>
                            {surgery.hospital || 'Hospital não informado'}
                          </div>
                          <div className="italic truncate opacity-80" title={surgery.procedure}>
                            {surgery.procedure}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Cirurgias de {selectedDay && format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDaySurgeries.map((surgery, index) => (
              <Card 
                key={surgery.id} 
                className={`cursor-pointer hover:shadow-lg transition-shadow ${
                  selectedDaySurgeries.length > 1 ? getColorForIndex(index) : ""
                }`}
                onClick={() => navigate(`/patients/${surgery.id}/exams`)}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">{surgery.name}</h3>
                      <span className="text-lg font-semibold">
                        {format(new Date(surgery.surgery_date), "HH:mm")}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="font-semibold">Procedimento:</span>{" "}
                        <span className="capitalize">{surgery.procedure}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Hospital:</span>{" "}
                        <span>{surgery.hospital || "Não informado"}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic mt-2">
                      Clique para ver os exames pré operatórios do paciente
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
