import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings2, CalendarOff, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { useGoogleCalendarAvailability } from "@/hooks/useGoogleCalendarAvailability";
import { useSurgeryAvailability } from "@/hooks/useSurgeryAvailability";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { CalendarDayView } from "@/components/CalendarDayView";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfessionals } from "@/hooks/useProfessionals";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

const Calendar = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { professionals } = useProfessionals();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connectedDoctorId, setConnectedDoctorId] = useState<string | undefined>();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockMode, setBlockMode] = useState<"single" | "period">("single");
  const { busySlots, fetchAvailability } = useGoogleCalendarAvailability();
  const { slots: availabilitySlots, getSlotsForDay } = useSurgeryAvailability();
  const { isDateBlocked, blocks, addBlock, deleteBlock } = useScheduleBlocks();

  // For admins: check Google Calendar connections for doctors
  const [doctorConnections, setDoctorConnections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAdmin) {
      // Check which doctors have Google Calendar connected
      const checkConnections = async () => {
        const { data } = await supabase
          .from("google_calendar_connections")
          .select("user_id");
        if (data) {
          const connections: Record<string, boolean> = {};
          data.forEach(c => { connections[c.user_id] = true; });
          setDoctorConnections(connections);
          
          // Auto-connect if any doctor has connection
          if (data.length > 0) {
            setCalendarConnected(true);
            // If only one doctor connected, auto-select
            if (data.length === 1) {
              setConnectedDoctorId(data[0].user_id);
              setSelectedDoctorId(data[0].user_id);
            }
          }
        }
      };
      checkConnections();
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSurgeries();
  }, []);

  useEffect(() => {
    if (isAdmin && selectedDoctorId !== "all" && doctorConnections[selectedDoctorId]) {
      setConnectedDoctorId(selectedDoctorId);
      setCalendarConnected(true);
      fetchAvailability(currentDate, selectedDoctorId);
    } else if (isAdmin && selectedDoctorId === "all") {
      // When "all" is selected, try to fetch for the first connected doctor
      const firstConnected = Object.keys(doctorConnections)[0];
      if (firstConnected) {
        setConnectedDoctorId(firstConnected);
        fetchAvailability(currentDate, firstConnected);
      }
    } else if (!isAdmin && calendarConnected) {
      fetchAvailability(currentDate, connectedDoctorId);
    }
  }, [calendarConnected, currentDate, fetchAvailability, connectedDoctorId, isAdmin, selectedDoctorId, doctorConnections]);

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
      "bg-primary/5 border-l-primary",
      "bg-success/10 border-l-success",
      "bg-purple-500/10 border-l-purple-600",
      "bg-warning/10 border-l-warning",
      "bg-pink-500/10 border-l-pink-500",
      "bg-cyan-500/10 border-l-cyan-600",
    ];
    return colors[index % colors.length];
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day);
  };

  const handleBlockDay = () => {
    if (!selectedDay) return;
    setBlockMode("single");
    setBlockReason("");
    setBlockEndDate("");
    setBlockDialogOpen(true);
  };

  const handleConfirmBlock = async () => {
    if (!selectedDay) return;
    const startStr = format(selectedDay, "yyyy-MM-dd");
    const endStr = blockMode === "period" && blockEndDate ? blockEndDate : startStr;
    if (blockMode === "period" && endStr < startStr) {
      toast.error("A data final deve ser maior ou igual à data inicial");
      return;
    }
    await addBlock(startStr, endStr, blockReason || undefined);
    setBlockDialogOpen(false);
  };

  const handleUnblockDay = async () => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    const block = blocks.find(b => dateStr >= b.start_date && dateStr <= b.end_date);
    if (block) {
      await deleteBlock(block.id);
    }
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const selectedDaySurgeries = selectedDay ? getSurgeriesForDay(selectedDay) : [];
  const monthSurgeries = surgeries.filter(s => isSameMonth(new Date(s.surgery_date), currentDate));
  const eventsToShow = selectedDay ? selectedDaySurgeries : monthSurgeries;

  const selectedDayHasAvailability = selectedDay
    ? getSlotsForDay(selectedDay.getDay()).length > 0
    : false;

  const selectedDayBlocked = selectedDay ? isDateBlocked(selectedDay) : false;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* iOS-style top header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Agenda de Cirurgias</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Procedimentos agendados</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-muted/60"
          onClick={() => navigate("/surgery-availability")}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 pb-2">
        <GoogleCalendarConnect onConnectionChange={(connected, doctorId) => {
          setCalendarConnected(connected);
          setConnectedDoctorId(doctorId);
        }} />
      </div>

      {/* Calendar card */}
      <div className="mx-4 rounded-2xl bg-card border shadow-sm overflow-hidden mb-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full active:scale-90 transition-transform"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <button
            className="flex items-center gap-1.5 font-semibold text-sm text-foreground"
            onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}
          >
            <CalendarIcon className="h-4 w-4 text-primary" />
            <AnimatePresence mode="wait">
              <motion.span
                key={format(currentDate, "yyyy-MM")}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="capitalize"
              >
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </motion.span>
            </AnimatePresence>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full active:scale-90 transition-transform"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent mx-auto" />
            <p className="mt-3 text-xs text-muted-foreground">Carregando...</p>
          </div>
        ) : (
          <>
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`text-center py-2 text-[10px] font-semibold tracking-wide ${
                    i === 0 ? "text-destructive/70" : i === 6 ? "text-blue-500/70" : "text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells — animate whole grid on month change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={format(currentDate, "yyyy-MM")}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="grid grid-cols-7"
              >
                {calendarDays.map((day, index) => {
                  const daySurgeries = getSurgeriesForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasAvailability = getSlotsForDay(day.getDay()).length > 0;
                  const isBlocked = isDateBlocked(day);
                  const isSunday = day.getDay() === 0;
                  const isSaturday = day.getDay() === 6;

                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleDayClick(day)}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className={`
                        relative flex flex-col items-center justify-start pt-1.5 pb-1 h-12
                        border-b border-r border-border/40 last:border-r-0
                        transition-colors duration-150
                        ${!isCurrentMonth ? "opacity-30" : ""}
                        ${isSelected ? "bg-primary/[0.07]" : isBlocked ? "bg-destructive/5" : "bg-card"}
                      `}
                    >
                      {/* Day number with selection ring animation */}
                      <motion.span
                        layout
                        animate={isSelected && !isToday ? {
                          scale: [1, 1.18, 1],
                          transition: { duration: 0.28, ease: "easeOut" }
                        } : { scale: 1 }}
                        className={`
                          text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full leading-none
                          transition-all duration-200
                          ${isToday ? "bg-primary text-primary-foreground shadow-sm" : ""}
                          ${isSelected && !isToday ? "ring-2 ring-primary/70 text-primary bg-primary/10" : ""}
                          ${!isToday && !isSelected && isSunday ? "text-destructive/80" : ""}
                          ${!isToday && !isSelected && isSaturday ? "text-blue-500/80" : ""}
                          ${!isToday && !isSelected && !isSunday && !isSaturday && isCurrentMonth ? "text-foreground" : ""}
                        `}
                      >
                        {format(day, "d")}
                      </motion.span>

                      {/* Indicators row */}
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 h-2">
                        {isBlocked ? (
                          <CalendarOff className="h-2 w-2 text-destructive/60" />
                        ) : (
                          <>
                            {hasAvailability && daySurgeries.length === 0 && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-1 h-1 rounded-full bg-success/70"
                              />
                            )}
                            {daySurgeries.length > 0 && daySurgeries.length <= 3 && daySurgeries.map((_, i) => (
                              <motion.span
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.04 }}
                                className="w-1 h-1 rounded-full bg-primary"
                              />
                            ))}
                            {daySurgeries.length > 3 && (
                              <span className="text-[8px] font-bold text-primary leading-none">{daySurgeries.length}</span>
                            )}
                          </>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-muted/20">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground">Cirurgia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success/70" />
                <span className="text-[10px] text-muted-foreground">Disponível</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarOff className="h-2.5 w-2.5 text-destructive/60" />
                <span className="text-[10px] text-muted-foreground">Bloqueado</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Day detail section — animates in/out on day selection */}
      {!loading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay ? format(selectedDay, "yyyy-MM-dd") : `month-${format(currentDate, "yyyy-MM")}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-4 mb-24"
          >
            {selectedDay && selectedDayHasAvailability ? (
              <div className="rounded-2xl bg-card border shadow-sm overflow-hidden">
                {/* Day header with actions */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      {format(selectedDay, "EEEE", { locale: ptBR })}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDayBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 gap-1.5 text-destructive border-destructive/40 text-xs"
                        onClick={handleUnblockDay}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Desbloquear
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 gap-1.5 text-xs"
                        onClick={handleBlockDay}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Bloquear
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-xs text-muted-foreground"
                      onClick={() => setSelectedDay(null)}
                    >
                      Mês
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <CalendarDayView
                    date={selectedDay}
                    surgeries={surgeries}
                    availabilitySlots={availabilitySlots}
                    busySlots={busySlots}
                    calendarConnected={calendarConnected}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    {selectedDay ? (
                      <>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          {format(selectedDay, "EEEE", { locale: ptBR })}
                        </p>
                        <p className="text-sm font-bold text-foreground">
                          {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-foreground capitalize">
                        {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>

                  {selectedDay && (
                    <div className="flex items-center gap-2">
                      {selectedDayBlocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 gap-1.5 text-destructive border-destructive/40 text-xs"
                          onClick={handleUnblockDay}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Desbloquear
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 gap-1.5 text-xs"
                          onClick={handleBlockDay}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Bloquear
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-xs text-muted-foreground"
                        onClick={() => setSelectedDay(null)}
                      >
                        Mês
                      </Button>
                    </div>
                  )}
                </div>

                {/* Events list */}
                <div className="divide-y divide-border/50">
                  {eventsToShow.length > 0 ? (
                    eventsToShow.map((surgery, index) => {
                      const surgeryDate = new Date(surgery.surgery_date);
                      return (
                        <motion.button
                          key={surgery.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.18 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 active:bg-muted/40 transition-colors border-l-[3px] ${getColorForIndex(index)}`}
                          onClick={() => navigate(`/patients/${surgery.id}/exams`)}
                        >
                          {/* Time badge */}
                          <div className="shrink-0 text-center">
                            <span className="text-sm font-bold text-foreground tabular-nums">
                              {format(surgeryDate, "HH:mm")}
                            </span>
                          </div>

                          {/* Divider */}
                          <div className="w-px h-8 bg-border/60 shrink-0" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{surgery.name}</p>
                            <p className="text-xs text-muted-foreground capitalize truncate">{surgery.procedure}</p>
                            {surgery.hospital && (
                              <p className="text-xs text-muted-foreground/70 truncate">{surgery.hospital}</p>
                            )}
                            {!selectedDay && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {format(surgeryDate, "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        </motion.button>
                      );
                    })
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="py-10 text-center"
                    >
                      <CalendarIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {selectedDay ? "Nenhuma cirurgia neste dia" : "Nenhuma cirurgia neste mês"}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Ban className="h-4 w-4" />
              Bloquear Agenda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDay && (
              <p className="text-sm text-muted-foreground">
                A partir de <strong>{format(selectedDay, "dd/MM/yyyy")}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={blockMode === "single" ? "default" : "outline"}
                size="sm"
                className="h-10"
                onClick={() => setBlockMode("single")}
              >
                Apenas este dia
              </Button>
              <Button
                variant={blockMode === "period" ? "default" : "outline"}
                size="sm"
                className="h-10"
                onClick={() => setBlockMode("period")}
              >
                Período
              </Button>
            </div>
            {blockMode === "period" && (
              <div className="space-y-2">
                <Label className="text-sm">Data final</Label>
                <Input
                  type="date"
                  value={blockEndDate}
                  min={selectedDay ? format(selectedDay, "yyyy-MM-dd") : undefined}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm">Motivo (opcional)</Label>
              <Input
                placeholder="Ex: Férias, Congresso..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setBlockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="h-11 flex-1"
              onClick={handleConfirmBlock}
              disabled={blockMode === "period" && !blockEndDate}
            >
              Confirmar Bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
