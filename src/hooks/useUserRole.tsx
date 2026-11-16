import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type UserRole = "admin" | "doctor" | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          setRole(null);
        } else {
          // Perfis antigos/desconhecidos (ex.: "dentist") ficam sem permissão
          const fetchedRole = data?.role;
          setRole(fetchedRole === "admin" || fetchedRole === "doctor" ? fetchedRole : null);
        }
      } catch (error) {
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";
  const isDoctor = role === "doctor";
  const isProfessional = isDoctor;
  const canEdit = isAdmin; // apenas admin pode criar/editar usuários
  const canDelete = isAdmin; // apenas admin pode deletar

  return {
    role,
    loading,
    isAdmin,
    isDoctor,
    isProfessional,
    canEdit,
    canDelete,
  };
}
