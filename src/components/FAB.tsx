import { Plus, MessageCircle, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

export function FAB() {
  const navigate = useNavigate();
  const { isAdmin, isDentist } = useUserRole();
  const [open, setOpen] = useState(false);

  if (!isAdmin && !isDentist) return null;

  return (
    <div className="md:hidden fixed bottom-24 right-4 z-[60] flex flex-col items-end gap-3">
      {open && (
        <>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/share-cirurgia");
            }}
            className="flex items-center gap-2 bg-card text-foreground px-4 py-2 rounded-full shadow-xl border border-border animate-in slide-in-from-bottom-2"
          >
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            <span className="text-sm font-medium">Importar do WhatsApp</span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/patients/new");
            }}
            className="flex items-center gap-2 bg-card text-foreground px-4 py-2 rounded-full shadow-xl border border-border animate-in slide-in-from-bottom-2"
          >
            <UserPlus className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Novo paciente</span>
          </button>
        </>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
        aria-label="Ações rápidas"
      >
        {open ? <X className="h-7 w-7" strokeWidth={2.5} /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
      </button>
    </div>
  );
}
