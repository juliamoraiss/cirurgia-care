import { useMemo } from "react";
import { format, isSameDay, addMinutes, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { BusySlot } from "@/hooks/useGoogleCalendarAvailability";
import type { SurgeryAvailabilitySlot } from "@/hooks/useSurgeryAvailability";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
}

interface CalendarDayViewProps {
  date: Date;
  surgeries: Surgery[];
  availabilitySlots: SurgeryAvailabilitySlot[];
  busySlots: BusySlot[];
  calendarConnected: boolean;
}

interface TimeSlot {
  time: Date;
  endTime: Date;
  type: "available" | "booked" | "busy";
  surgery?: Surgery;
  location?: string | null;
  allDay?: boolean;
  summary?: string;
}

export function CalendarDayView({
  date,
  surgeries,
  availabilitySlots,
  busySlots,
  calendarConnected,
}: CalendarDayViewProps) {
  const navigate = useNavigate();
  const dayOfWeek = date.getDay();

  const daySurgeries = surgeries.filter(s => isSameDay(new Date(s.surgery_date), date));

  // Build busy-only slots from Google Calendar for this day
  const googleBusyForDay = useMemo(() => {
    if (!calendarConnected) return [];
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return busySlots
      .filter(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return busyStart < dayEnd && busyEnd > dayStart;
      })
      .map(busy => ({
        start: new Date(busy.start) < dayStart ? dayStart : new Date(busy.start),
        end: new Date(busy.end) > dayEnd ? dayEnd : new Date(busy.end),
        allDay: busy.allDay,
        summary: busy.summary,
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [date, busySlots, calendarConnected]);

  const timeSlots = useMemo(() => {
    const dayAvailability = availabilitySlots.filter(a => a.day_of_week === dayOfWeek);

    // If no availability configured, show Google Calendar busy slots as standalone
    if (dayAvailability.length === 0) {
      if (googleBusyForDay.length === 0) return [];
      return googleBusyForDay.map(busy => ({
        time: busy.start,
        endTime: busy.end,
        type: "busy" as const,
        allDay: busy.allDay,
        summary: busy.summary,
      }));
    }

    const slots: TimeSlot[] = [];

    dayAvailability.forEach(avail => {
      const [startH, startM] = avail.start_time.split(":").map(Number);
      const [endH, endM] = avail.end_time.split(":").map(Number);
      const duration = avail.default_duration_minutes;

      let slotStart = setMinutes(setHours(new Date(date), startH), startM);
      const blockEnd = setMinutes(setHours(new Date(date), endH), endM);

      while (addMinutes(slotStart, duration) <= blockEnd) {
        const slotEnd = addMinutes(slotStart, duration);

        const bookedSurgery = daySurgeries.find(s => {
          const surgeryTime = new Date(s.surgery_date);
          return surgeryTime >= slotStart && surgeryTime < slotEnd;
        });

        const matchingBusy = calendarConnected ? busySlots.find(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        }) : undefined;

        if (bookedSurgery) {
          slots.push({ time: slotStart, endTime: slotEnd, type: "booked", surgery: bookedSurgery, location: avail.location });
        } else if (matchingBusy) {
          slots.push({ time: slotStart, endTime: slotEnd, type: "busy", location: avail.location, summary: matchingBusy.summary });
        } else {
          slots.push({ time: slotStart, endTime: slotEnd, type: "available", location: avail.location });
        }

        slotStart = slotEnd;
      }
    });

    // Add Google Calendar busy slots that fall OUTSIDE configured availability windows
    if (googleBusyForDay.length > 0) {
      googleBusyForDay.forEach(busy => {
        const busyStart = busy.start;
        const busyEnd = busy.end;

        // Check if this busy slot is already covered by an availability-based slot
        const alreadyCovered = slots.some(s =>
          s.type === "busy" && s.time <= busyStart && s.endTime >= busyEnd
        );

        if (!alreadyCovered) {
          // Check if it overlaps with any existing slot
          const overlapsExisting = slots.some(s =>
            busyStart < s.endTime && busyEnd > s.time
          );

          if (!overlapsExisting) {
            slots.push({
              time: busyStart,
              endTime: busyEnd,
              type: "busy",
              allDay: busy.allDay,
              summary: busy.summary,
            });
          }
        }
      });
    }

    return slots.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [date, dayOfWeek, availabilitySlots, daySurgeries, busySlots, calendarConnected, googleBusyForDay]);

  if (timeSlots.length === 0 && daySurgeries.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum horário configurado para {format(date, "EEEE", { locale: ptBR })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Configure sua disponibilidade em "Disponibilidade para Cirurgias"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timeSlots.map((slot, i) => (
        <div
          key={i}
          onClick={() => slot.surgery && navigate(`/patients/${slot.surgery.id}/exams`)}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
            slot.type === "booked"
              ? "bg-primary/5 border-primary/30 cursor-pointer hover:shadow-sm"
              : slot.type === "busy"
              ? "bg-muted/40 border-muted-foreground/20 opacity-60"
              : "bg-background border-border hover:bg-accent/30"
          }`}
        >
          {/* Time column */}
          <div className="w-16 text-center shrink-0">
            {slot.allDay ? (
              <span className="text-xs font-medium text-muted-foreground">Dia inteiro</span>
            ) : (
              <>
                <span className="text-sm font-bold">{format(slot.time, "HH:mm")}</span>
                <span className="block text-[10px] text-muted-foreground">{format(slot.endTime, "HH:mm")}</span>
              </>
            )}
          </div>

          {/* Divider */}
          <div className={`w-1 self-stretch rounded-full ${
            slot.type === "booked" ? "bg-primary" : slot.type === "busy" ? "bg-amber-500" : "bg-border"
          }`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {slot.type === "booked" && slot.surgery ? (
              <>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold truncate">{slot.surgery.name}</span>
                </div>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{slot.surgery.procedure}</p>
                {slot.surgery.hospital && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{slot.surgery.hospital}</span>
                  </div>
                )}
              </>
            ) : slot.type === "busy" ? (
              <span className="text-xs text-muted-foreground italic">Ocupado (Google Calendar)</span>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Disponível</span>
                {slot.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{slot.location}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status badge */}
          <Badge
            variant={slot.type === "booked" ? "default" : slot.type === "busy" ? "secondary" : "outline"}
            className="text-[10px] shrink-0"
          >
            {slot.type === "booked" ? "Agendado" : slot.type === "busy" ? "Ocupado" : "Livre"}
          </Badge>
        </div>
      ))}
    </div>
  );
}
