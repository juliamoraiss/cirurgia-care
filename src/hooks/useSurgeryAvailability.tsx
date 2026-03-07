import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SurgeryAvailabilitySlot {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  default_duration_minutes: number;
  max_surgeries_per_day: number;
  location: string | null;
  is_active: boolean;
}

export interface SurgeryAvailabilityInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  default_duration_minutes: number;
  max_surgeries_per_day: number;
  location: string | null;
}

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export { DAY_NAMES, DAY_SHORT };

export function useSurgeryAvailability(doctorId?: string) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<SurgeryAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const targetDoctorId = doctorId || user?.id;

  const fetchSlots = useCallback(async () => {
    if (!targetDoctorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("surgery_availability")
        .select("*")
        .eq("doctor_id", targetDoctorId)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      setSlots((data as SurgeryAvailabilitySlot[]) || []);
    } catch {
      toast.error("Erro ao carregar disponibilidade");
    } finally {
      setLoading(false);
    }
  }, [targetDoctorId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const addSlot = async (input: SurgeryAvailabilityInput) => {
    if (!targetDoctorId) return;
    try {
      const { error } = await supabase.from("surgery_availability").insert({
        doctor_id: targetDoctorId,
        ...input,
      });
      if (error) throw error;
      toast.success("Horário adicionado");
      await fetchSlots();
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
        toast.error("Esse horário já está configurado");
      } else {
        toast.error("Erro ao adicionar horário");
      }
    }
  };

  const updateSlot = async (id: string, input: Partial<SurgeryAvailabilityInput & { is_active: boolean }>) => {
    try {
      const { error } = await supabase
        .from("surgery_availability")
        .update(input)
        .eq("id", id);
      if (error) throw error;
      toast.success("Horário atualizado");
      await fetchSlots();
    } catch {
      toast.error("Erro ao atualizar horário");
    }
  };

  const deleteSlot = async (id: string) => {
    try {
      const { error } = await supabase
        .from("surgery_availability")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Horário removido");
      await fetchSlots();
    } catch {
      toast.error("Erro ao remover horário");
    }
  };

  const getActiveSlots = () => slots.filter(s => s.is_active);

  const getSlotsForDay = (dayOfWeek: number) =>
    slots.filter(s => s.day_of_week === dayOfWeek && s.is_active);

  return {
    slots,
    loading,
    addSlot,
    updateSlot,
    deleteSlot,
    fetchSlots,
    getActiveSlots,
    getSlotsForDay,
  };
}
