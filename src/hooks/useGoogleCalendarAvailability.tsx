import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export interface BusySlot {
  start: string;
  end: string;
  allDay?: boolean;
  summary?: string;
}

interface AvailabilityData {
  busy_slots: BusySlot[];
  timezone: string;
  fetched_at: string;
}

export function useGoogleCalendarAvailability() {
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchAvailability = useCallback(async (date: Date, targetUserId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const timeMin = startOfMonth(date).toISOString();
      const timeMax = endOfMonth(addMonths(date, 0)).toISOString();

      const { data, error: fnError } = await supabase.functions.invoke(
        "google-calendar-availability",
        {
          body: {
            time_min: timeMin,
            time_max: timeMax,
            target_user_id: targetUserId,
          },
        }
      );

      if (fnError) {
        throw new Error("Erro ao buscar disponibilidade");
      }

      if (data?.error) {
        if (data.connected === false) {
          setBusySlots([]);
          setError("not_connected");
          return;
        }
        throw new Error(data.error);
      }

      const availability = data as AvailabilityData;
      setBusySlots(availability.busy_slots || []);
      setLastFetched(new Date(availability.fetched_at));
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
      setBusySlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const isSlotBusy = useCallback(
    (slotStart: Date, slotEnd: Date): boolean => {
      return busySlots.some((busy) => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });
    },
    [busySlots]
  );

  const getBusySlotsForDay = useCallback(
    (day: Date): BusySlot[] => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      return busySlots.filter((busy) => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return busyStart < dayEnd && busyEnd > dayStart;
      });
    },
    [busySlots]
  );

  const isDayFullyBusy = useCallback(
    (day: Date): boolean => {
      return busySlots.some((busy) => {
        if (!busy.allDay) return false;
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        return busyStart <= dayStart && busyEnd >= dayEnd;
      });
    },
    [busySlots]
  );

  return {
    busySlots,
    loading,
    error,
    lastFetched,
    fetchAvailability,
    isSlotBusy,
    getBusySlotsForDay,
    isDayFullyBusy,
  };
}
