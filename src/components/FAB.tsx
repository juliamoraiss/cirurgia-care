import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

export function FAB() {
  const navigate = useNavigate();
  const { isAdmin, isDentist } = useUserRole();

  // Show FAB for admins and dentists
  if (!isAdmin && !isDentist) return null;

  return (
    <button
      onClick={() => navigate("/patients/new")}
      className="md:hidden fixed bottom-24 right-4 z-[60] w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
      aria-label="Novo Paciente"
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
