import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ScheduleBlock {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

export function useScheduleBlocks() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("doctor_id", user.id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setBlocks((data as ScheduleBlock[]) || []);
    } catch {
      toast.error("Erro ao carregar bloqueios");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const addBlock = async (startDate: string, endDate: string, reason?: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from("schedule_blocks").insert({
        doctor_id: user.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason?.trim() || null,
      });
      if (error) throw error;
      toast.success("Bloqueio adicionado");
      await fetchBlocks();
    } catch {
      toast.error("Erro ao adicionar bloqueio");
    }
  };

  const deleteBlock = async (id: string) => {
    try {
      const { error } = await supabase
        .from("schedule_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Bloqueio removido");
      await fetchBlocks();
    } catch {
      toast.error("Erro ao remover bloqueio");
    }
  };

  const isDateBlocked = useCallback((date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return blocks.some(b => dateStr >= b.start_date && dateStr <= b.end_date);
  }, [blocks]);

  return { blocks, loading, addBlock, deleteBlock, isDateBlocked, fetchBlocks };
}
