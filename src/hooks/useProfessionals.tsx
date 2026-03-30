import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Professional {
  id: string;
  full_name: string;
  user_type: string | null;
}

export function useProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfessionals() {
      try {
        // Fetch users who have roles (doctors, dentists, admins)
        const { data: roleUsers, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role");

        if (rolesError) throw rolesError;

        if (roleUsers && roleUsers.length > 0) {
          const userIds = roleUsers.map((r) => r.user_id);

          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, user_type")
            .in("id", userIds);

          if (profilesError) throw profilesError;

          // Filter to only include doctors and dentists (exclude admin-only users)
          const professionalsData = (profiles || []).filter((p) => {
            const userRoles = roleUsers.filter((r) => r.user_id === p.id);
            return userRoles.some((r) => r.role === "doctor" || r.role === "dentist");
          });

          setProfessionals(professionalsData);
        }
      } catch (error) {
        console.error("Error fetching professionals:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfessionals();
  }, []);

  return { professionals, loading };
}
