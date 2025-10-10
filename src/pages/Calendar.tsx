import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

  const weekDays = viewMode === "week" 
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["D", "S", "T", "Q", "Q", "S", "S"];

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

          {/* Toggle Semana/Mês - Mobile */}
          <div className="md:hidden">
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
          </div>

          {/* Toggle Semana/Mês - Desktop */}
          <div className="hidden md:flex justify-end">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <TabsList>
                <TabsTrigger value="week">
                  <List className="h-4 w-4 mr-2" />
                  Visualização Semanal
                </TabsTrigger>
                <TabsTrigger value="month">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Visualização Mensal
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className={`grid grid-cols-7 ${viewMode === "week" ? "gap-2 md:gap-3" : "gap-1 md:gap-2"}`}>
              {weekDays.map((day) => (
                <div 
                  key={day} 
                  className={`text-center font-semibold p-2 text-muted-foreground ${
                    viewMode === "week" ? "text-sm md:text-base" : "text-xs md:text-sm"
                  }`}
                >
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const daySurgeries = getSurgeriesForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day, daySurgeries)}
                    className={`border rounded-lg p-2 ${
                      viewMode === "week" 
                        ? "min-h-[180px] md:min-h-[200px]" 
                        : "min-h-[80px] md:min-h-[120px]"
                    } ${
                      isCurrentMonth ? "bg-background" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-primary" : ""} ${
                      daySurgeries.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""
                    }`}
                  >
                    <div className={`font-semibold mb-1 ${
                      viewMode === "week" ? "text-base md:text-lg" : "text-xs md:text-sm"
                    } ${
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {daySurgeries.map((surgery, surgeryIndex) => (
                        <div
                          key={surgery.id}
                          className={`p-1.5 rounded border-l-2 space-y-0.5 ${
                            viewMode === "week" ? "text-xs md:text-sm" : "text-[10px] md:text-xs"
                          } ${
                            daySurgeries.length > 1 
                              ? getColorForIndex(surgeryIndex)
                              : "bg-primary/10 border-primary text-primary"
                          }`}
                        >
                          <div className="font-semibold">
                            {format(new Date(surgery.surgery_date), "HH:mm")}
                          </div>
                          {viewMode === "week" && (
                            <>
                              <div className="font-medium truncate" title={surgery.name}>
                                {surgery.name}
                              </div>
                              <div className="truncate opacity-80" title={surgery.hospital || 'Hospital não informado'}>
                                {surgery.hospital || 'Hospital não informado'}
                              </div>
                              <div className="italic truncate opacity-80" title={surgery.procedure}>
                                {surgery.procedure}
                              </div>
                            </>
                          )}
                          {viewMode === "month" && (
                            <div className="font-medium truncate" title={surgery.name}>
                              {surgery.name}
                            </div>
                          )}
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