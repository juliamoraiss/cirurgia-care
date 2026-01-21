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

          // Filter to only include doctors and dentists (not admins who are only admins)
          const professionalsData = (profiles || []).filter((p) => {
            const userRole = roleUsers.find((r) => r.user_id === p.id);
            return userRole?.role === "doctor" || userRole?.role === "dentist" || userRole?.role === "admin";
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
