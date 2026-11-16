import { Plus, MessageCircle, UserPlus, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

/** Telas de formulário, onde o botão "+" só atrapalha. */
const HIDDEN_ROUTES = [/^\/patients\/new$/, /^\/patients\/[^/]+$/, /^\/share-cirurgia$/, /^\/users$/, /^\/surgery-availability$/];

export function FAB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isDentist } = useUserRole();
  const [open, setOpen] = useState(false);

  // Fecha o menu ao trocar de tela
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!isAdmin && !isDentist) return null;
  if (HIDDEN_ROUTES.some((re) => re.test(location.pathname))) return null;

  return (
    <>
      {/* Fundo: tocar fora fecha o menu */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-[59] bg-background/60 backdrop-blur-[1px] animate-in fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="md:hidden fixed bottom-24 right-4 z-[60] flex flex-col items-end gap-3">
        {open && (
          <>
            <button
              onClick={() => navigate("/share-cirurgia")}
              className="flex items-center gap-2 bg-card text-foreground px-4 py-2 rounded-full shadow-xl border border-border animate-in slide-in-from-bottom-2"
            >
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              <span className="text-sm font-medium">Importar do WhatsApp</span>
            </button>
            <button
              onClick={() => navigate("/patients/new")}
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
          aria-label={open ? "Fechar ações rápidas" : "Ações rápidas"}
          aria-expanded={open}
        >
          {open ? <X className="h-7 w-7" strokeWidth={2.5} /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
        </button>
      </div>
    </>
  );
}
