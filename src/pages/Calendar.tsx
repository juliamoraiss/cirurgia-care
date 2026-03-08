import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings2, CalendarOff, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { useGoogleCalendarAvailability } from "@/hooks/useGoogleCalendarAvailability";
import { useSurgeryAvailability } from "@/hooks/useSurgeryAvailability";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { CalendarDayView } from "@/components/CalendarDayView";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

const Calendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockMode, setBlockMode] = useState<"single" | "period">("single");
  const { getBusySlotsForDay, isDayFullyBusy, busySlots, fetchAvailability, loading: busyLoading, lastFetched } = useGoogleCalendarAvailability();
  const { slots: availabilitySlots, getSlotsForDay } = useSurgeryAvailability();
  const { isDateBlocked } = useScheduleBlocks();

  useEffect(() => {
    loadSurgeries();
  }, []);

  useEffect(() => {
    if (calendarConnected) {
      fetchAvailability(currentDate);
    }
  }, [calendarConnected, currentDate, fetchAvailability]);

  async function loadSurgeries() {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, procedure, surgery_date, hospital")
        .not("surgery_date", "is", null)
        .order("surgery_date", { ascending: true });

      if (error) throw error;
      setSurgeries(data || []);
    } catch {
      toast.error("Erro ao carregar cirurgias agendadas");
    } finally {
      setLoading(false);
    }
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSurgeriesForDay = (day: Date) =>
    surgeries
      .filter((s) => isSameDay(new Date(s.surgery_date), day))
      .sort((a, b) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime());

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

  const handleDayClick = (day: Date) => {
    setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day);
  };

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const selectedDaySurgeries = selectedDay ? getSurgeriesForDay(selectedDay) : [];
  const monthSurgeries = surgeries.filter(s => isSameMonth(new Date(s.surgery_date), currentDate));
  const eventsToShow = selectedDay ? selectedDaySurgeries : monthSurgeries;

  // Check if selected day has availability config
  const selectedDayHasAvailability = selectedDay
    ? getSlotsForDay(selectedDay.getDay()).length > 0
    : false;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Agenda de Cirurgias</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Visualize e gerencie os procedimentos agendados
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate("/surgery-availability")}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Disponibilidade</span>
        </Button>
      </div>

      <GoogleCalendarConnect onConnectionChange={setCalendarConnected} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <CalendarIcon className="h-5 w-5 mr-2" />
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day, i) => (
                    <div key={i} className="text-center font-semibold p-2 text-muted-foreground text-xs md:text-sm">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const daySurgeries = getSurgeriesForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const dayBusySlots = calendarConnected ? getBusySlotsForDay(day) : [];
                    const isFullyBusy = calendarConnected && isDayFullyBusy(day);
                    const hasAvailability = getSlotsForDay(day.getDay()).length > 0;
                    const isBlocked = isDateBlocked(day);

                    return (
                      <div
                        key={index}
                        onClick={() => handleDayClick(day)}
                        className={`border rounded-lg p-1.5 md:p-2 min-h-[60px] md:min-h-[80px] flex flex-col cursor-pointer transition-all ${
                          isCurrentMonth ? "bg-background" : "bg-muted/30 opacity-50"
                        } ${isToday ? "ring-2 ring-primary" : ""} ${
                          isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                        } ${isFullyBusy || isBlocked ? "bg-muted/40" : ""}`}
                      >
                        <div className={`flex items-center justify-between text-sm md:text-base font-bold ${
                          isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          <span className={isToday ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-xs" : ""}>
                            {format(day, "d")}
                          </span>
                          {dayBusySlots.length > 0 && !isFullyBusy && (
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                          )}
                        </div>
                        {/* Blocked indicator */}
                        {isBlocked && (
                          <div className="mt-1 flex items-center gap-1">
                            <CalendarOff className="h-3 w-3 text-destructive/70" />
                            <span className="text-[9px] text-destructive/70 font-medium">Bloqueado</span>
                          </div>
                        )}
                        {/* Availability indicator */}
                        {!isBlocked && hasAvailability && daySurgeries.length === 0 && (
                          <div className="mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 inline-block" />
                          </div>
                        )}
                        {daySurgeries.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {daySurgeries.length <= 3 ? (
                              daySurgeries.map((_, i) => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                              ))
                            ) : (
                              <span className="text-[10px] font-semibold text-primary">{daySurgeries.length}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day View or Events List */}
              <div className="mt-6 border-t pt-4">
                {selectedDay && selectedDayHasAvailability ? (
                  <>
                    <div className="flex items-center justify-end mb-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                        Ver todo o mês
                      </Button>
                    </div>
                    <CalendarDayView
                      date={selectedDay}
                      surgeries={surgeries}
                      availabilitySlots={availabilitySlots}
                      busySlots={busySlots}
                      calendarConnected={calendarConnected}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">
                        {selectedDay
                          ? format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : `Cirurgias de ${format(currentDate, "MMMM", { locale: ptBR })}`}
                      </h3>
                      {selectedDay && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                          Ver todo o mês
                        </Button>
                      )}
                    </div>
                    {eventsToShow.length > 0 ? (
                      <div className="space-y-3">
                        {eventsToShow.map((surgery, index) => {
                          const surgeryDate = new Date(surgery.surgery_date);
                          return (
                            <Card
                              key={surgery.id}
                              className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getColorForIndex(index)}`}
                              onClick={() => navigate(`/patients/${surgery.id}/exams`)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-base truncate">{surgery.name}</h4>
                                    <p className="text-sm text-muted-foreground capitalize">{surgery.procedure}</p>
                                    {surgery.hospital && (
                                      <p className="text-xs text-muted-foreground mt-1">{surgery.hospital}</p>
                                    )}
                                    {!selectedDay && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {format(surgeryDate, "dd/MM/yyyy", { locale: ptBR })}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-lg font-bold ml-4">
                                    {format(surgeryDate, "HH:mm")}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm py-4 text-center">
                        {selectedDay ? "Nenhuma cirurgia agendada para este dia" : "Nenhuma cirurgia agendada para este mês"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;
