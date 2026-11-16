import { ReactNode } from "react";
import { useMainScroll } from "@/hooks/useMainScroll";
import { isAndroid } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface FABProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

/**
 * Extended FAB (Material 3) — só no Android e só no celular. Cada tela coloca
 * o seu ("Novo paciente", "Nova tarefa"...). Some ao rolar para baixo e volta
 * ao rolar para cima. No iOS a ação fica no "+" do cabeçalho.
 */
export function FAB({ icon, label, onClick }: FABProps) {
  const { direction } = useMainScroll();
  if (!isAndroid) return null;

  const hidden = direction === "down";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "md:hidden fixed right-4 z-[45] flex items-center gap-3 h-14 pl-4 pr-5 rounded-2xl",
        "bg-primary text-primary-foreground shadow-lg active:shadow-md transition-all duration-200",
        "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]",
        hidden ? "translate-y-[calc(100%+6rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      )}
    >
      <span className="[&_svg]:h-6 [&_svg]:w-6">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
