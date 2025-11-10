import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay, addHours, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

type ViewMode = "month" | "week";

const Calendar = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
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

  const getCalendarDays = () => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { locale: ptBR });
      const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  };

  const calendarDays = getCalendarDays();

  const getSurgeriesForDay = (day: Date) => {
    return surgeries
      .filter((surgery) => isSameDay(new Date(surgery.surgery_date), day))
      .sort((a, b) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime());
  };

  const getColorForIndex = (index: number) => {
    const colors = [
      "bg-blue-500/20 border-blue-500 text-blue-900 dark:text-blue-100",
      "bg-green-500/20 border-green-500 text-green-900 dark:text-green-100",
      "bg-purple-500/20 border-purple-500 text-purple-900 dark:text-purple-100",
      "bg-orange-500/20 border-orange-500 text-orange-900 dark:text-orange-100",
      "bg-pink-500/20 border-pink-500 text-pink-900 dark:text-pink-100",
      "bg-cyan-500/20 border-cyan-500 text-cyan-900 dark:text-cyan-100",
    ];
    return colors[index % colors.length];
  };

  const handleDayClick = (day: Date, daySurgeries: Surgery[]) => {
    if (daySurgeries.length > 0) {
      setSelectedDay(day);
      setSelectedDaySurgeries(daySurgeries);
    }
  };

  const handlePrevious = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const getDateRangeText = () => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return `${format(weekStart, "dd MMM", { locale: ptBR })} - ${format(weekEnd, "dd MMM yyyy", { locale: ptBR })}`;
    } else {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const weekDaysFull = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Gerar horários de 6h às 22h
  const timeSlots = Array.from({ length: 17 }, (_, i) => addHours(startOfDay(new Date()), i + 6));

  const getSurgeryPosition = (surgery: Surgery) => {
    const surgeryDate = new Date(surgery.surgery_date);
    const hour = surgeryDate.getHours();
    const minutes = surgeryDate.getMinutes();
    const startHour = 6;
    
    if (hour < startHour || hour >= 23) return null;
    
    const topPosition = ((hour - startHour) * 60 + minutes);
    return topPosition;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Agenda de Cirurgias</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Visualize e gerencie os procedimentos agendados
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <CalendarIcon className="h-5 w-5 mr-2" />
              {getDateRangeText()}
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                className="flex-1 sm:flex-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="flex-1 sm:flex-none"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Toggle Semana/Mês */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="week" className="text-sm">
                <List className="h-4 w-4 mr-2" />
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="text-sm">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Mês
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando...</p>
            </div>
          ) : viewMode === "week" ? (
            // Visualização Semanal
            isMobile ? (
              // Mobile: Lista vertical por dia
              <div className="space-y-4">
                {calendarDays.map((day, dayIndex) => {
                  const daySurgeries = getSurgeriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  if (daySurgeries.length === 0) return null;
                  
                  return (
                    <div key={dayIndex} className="border rounded-lg p-3">
                      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                        isToday ? 'text-primary font-semibold' : ''
                      }`}>
                        <div className="text-sm font-medium">
                          {format(day, "EEEE", { locale: ptBR })}
                        </div>
                        <div className={`text-lg font-bold ${
                          isToday ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center' : ''
                        }`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {daySurgeries.map((surgery, surgeryIndex) => {
                          const surgeryDate = new Date(surgery.surgery_date);
                          
                          return (
                            <div
                              key={surgery.id}
                              onClick={() => navigate(`/patients/${surgery.id}/exams?from=calendar`)}
                              className={`rounded-lg p-3 cursor-pointer border-l-4 ${
                                getColorForIndex(surgeryIndex)
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold mb-1">
                                    {format(surgeryDate, 'HH:mm')}
                                  </div>
                                  <div className="text-sm font-semibold truncate">
                                    {surgery.name}
                                  </div>
                                  <div className="text-xs opacity-80 truncate mt-1">
                                    {surgery.hospital || 'Hospital não informado'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {calendarDays.every(day => getSurgeriesForDay(day).length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma cirurgia agendada para esta semana
                  </div>
                )}
              </div>
            ) : (
              // Desktop: Timeline
              <div className="overflow-x-auto -mx-2 px-2">
                <div className="min-w-[750px] grid grid-cols-8 gap-2 md:gap-3">
                  {/* Header com dias da semana */}
                  <div className="grid grid-cols-8 gap-2 mb-4 sticky top-0 bg-background z-10 pb-2">
                    <div className="text-xs text-muted-foreground"></div>
                    {calendarDays.map((day, index) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={index} className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            {weekDaysFull[index]}
                          </div>
                          <div className={`text-2xl font-bold rounded-full w-12 h-12 mx-auto flex items-center justify-center ${
                            isToday ? 'bg-primary text-primary-foreground' : ''
                          }`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Timeline de horários */}
                  <div className="relative">
                    {timeSlots.map((time, timeIndex) => (
                      <div key={timeIndex} className="grid grid-cols-8 gap-2 border-t border-muted">
                        {/* Coluna de horário */}
                        <div className="text-xs text-muted-foreground py-2 text-right pr-2">
                          {format(time, 'HH:mm')}
                        </div>
                        
                        {/* Colunas dos dias */}
                        {calendarDays.map((day, dayIndex) => {
                          const daySurgeries = getSurgeriesForDay(day);
                          const surgeriesInThisHour = daySurgeries.filter(surgery => {
                            const surgeryDate = new Date(surgery.surgery_date);
                            return surgeryDate.getHours() === time.getHours();
                          });

                          return (
                            <div key={dayIndex} className="relative min-h-[60px] border-l border-muted">
                              {surgeriesInThisHour.map((surgery, surgeryIndex) => {
                                const surgeryDate = new Date(surgery.surgery_date);
                                const minutes = surgeryDate.getMinutes();
                                const topOffset = minutes;

                                return (
                                  <div
                                    key={surgery.id}
                                    onClick={() => navigate(`/patients/${surgery.id}/exams?from=calendar`)}
                                    className={`absolute left-1 right-1 rounded-lg p-2 cursor-pointer border-l-4 ${
                                      getColorForIndex(surgeryIndex)
                                    }`}
                                    style={{
                                      top: `${topOffset}px`,
                                      minHeight: '50px'
                                    }}
                                  >
                                    <div className="text-xs font-bold">
                                      {format(surgeryDate, 'HH:mm')}
                                    </div>
                                    <div className="text-xs font-semibold truncate mt-1">
                                      {surgery.name}
                                    </div>
                                    <div className="text-[10px] opacity-80 truncate">
                                      {surgery.hospital || 'Hospital não informado'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : isMobile ? (
            // Visualização Mensal Mobile - Lista por Data (estilo Google Calendar)
            <div className="space-y-6">
              {calendarDays
                .filter((day) => isSameMonth(day, currentDate))
                .map((day, dayIndex) => {
                  const daySurgeries = getSurgeriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  if (daySurgeries.length === 0) return null;
                  
                  return (
                    <div key={dayIndex}>
                      {/* Cabeçalho da Data */}
                      <div className={`mb-3 pb-2 ${
                        isToday ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        <h3 className="text-sm font-bold uppercase tracking-wide">
                          {format(day, "EEEE', 'dd' DE 'MMM'.'", { locale: ptBR }).toUpperCase()}
                        </h3>
                      </div>
                      
                      {/* Lista de Eventos */}
                      <div className="space-y-2">
                        {daySurgeries.map((surgery, surgeryIndex) => {
                          const surgeryDate = new Date(surgery.surgery_date);
                          
                          return (
                            <div
                              key={surgery.id}
                              onClick={() => navigate(`/patients/${surgery.id}/exams?from=calendar`)}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-l-4 ${
                                getColorForIndex(surgeryIndex)
                              } hover:shadow-md transition-shadow`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base truncate mb-1">
                                  {surgery.name}
                                </div>
                                {surgery.hospital && (
                                  <div className="text-xs opacity-80 truncate">
                                    {surgery.hospital}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">
                                  {format(surgeryDate, 'HH:mm')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
              {calendarDays
                .filter((day) => isSameMonth(day, currentDate))
                .every((day) => getSurgeriesForDay(day).length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma cirurgia agendada para este mês</p>
                </div>
              )}
            </div>
          ) : (
            // Visualização Mensal Desktop - Grade
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {weekDays.map((day) => (
                  <div 
                    key={day} 
                    className="text-center font-semibold p-2 text-muted-foreground text-xs md:text-sm"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((day, index) => {
                const daySurgeries = getSurgeriesForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day, daySurgeries)}
                    className={`border rounded-lg p-2 md:p-3 min-h-[120px] md:min-h-[140px] flex flex-col ${
                      isCurrentMonth ? "bg-background" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-primary" : ""} ${
                      daySurgeries.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""
                    }`}
                  >
                    <div className={`font-bold mb-2 text-sm md:text-base ${
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[90px] md:max-h-[100px]">
                      {daySurgeries.map((surgery, surgeryIndex) => {
                        // Abrevia nome se muito longo
                        const shortName = surgery.name.split(' ').slice(0, 2).join(' ');
                        const displayName = surgery.name.length > 20 ? shortName : surgery.name;
                        
                        return (
                          <div
                            key={surgery.id}
                            className={`p-2 rounded border-l-2 text-xs ${
                              daySurgeries.length > 1 
                                ? getColorForIndex(surgeryIndex)
                                : "bg-primary/10 border-primary text-primary"
                            }`}
                          >
                            <div className="font-bold mb-0.5">
                              {format(new Date(surgery.surgery_date), "HH:mm")}
                            </div>
                            <div className="font-semibold leading-tight" title={surgery.name}>
                              {displayName}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl">
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
                onClick={() => navigate(`/patients/${surgery.id}/exams?from=calendar`)}
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