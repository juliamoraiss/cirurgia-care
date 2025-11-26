import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type UserRole = "admin" | "user" | null;

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
          .maybeSingle();

        if (error) {
          setRole(null);
        } else {
          setRole(data?.role as UserRole);
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
  const isUser = role === "user";
  const canEdit = isAdmin; // apenas admin pode criar/editar
  const canDelete = isAdmin; // apenas admin pode deletar

  return {
    role,
    loading,
    isAdmin,
    isUser,
    canEdit,
    canDelete,
  };
}
