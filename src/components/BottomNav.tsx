import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarDays, CheckSquare, Ellipsis, House, Users } from "lucide-react";
import { endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { isNavItemActive } from "@/lib/navigation";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

/** Quantidade de tarefas abertas com prazo até o fim de hoje (atrasadas + hoje). */
function useDueTasksCount(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    supabase
      .from("patient_tasks")
      .select("id", { count: "exact", head: true })
      .eq("completed", false)
      .lte("due_date", endOfDay(new Date()).toISOString())
      .then(({ count: total }) => {
        if (!cancelled) setCount(total || 0);
      });

    return () => {
      cancelled = true;
    };
    // Recalcula ao trocar de tela (ex.: depois de concluir tarefas)
  }, [enabled, pathname]);

  return count;
}

/**
 * Barra de abas do celular.
 *  - iOS: sem "pílula"; o item ativo só muda de cor (tint), rótulo 10pt.
 *  - Android (Material 3): pílula atrás do ícone ativo.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const dueTasks = useDueTasksCount(isAdmin, location.pathname);

  const navItems = [
    { icon: House, label: "Início", path: "/" },
    { icon: Users, label: "Pacientes", path: "/patients" },
    { icon: CalendarDays, label: "Agenda", path: "/calendar" },
    ...(isAdmin ? [{ icon: CheckSquare, label: "Tarefas", path: "/tasks", badge: dueTasks }] : []),
    { icon: Ellipsis, label: "Mais", path: "/more" },
  ];

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]",
        isIOS
          ? "bg-page-background/85 backdrop-blur-xl backdrop-saturate-150 border-t border-border/60"
          : "bg-secondary dark:bg-card"
      )}
    >
      <div className={cn("flex items-stretch justify-around px-1", isIOS ? "h-[49px]" : "h-20")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.path, location.pathname);
          const badge = "badge" in item ? item.badge : 0;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? "page" : undefined}
              aria-label={badge ? `${item.label} (${badge} pendentes)` : item.label}
              className={cn(
                "flex flex-col items-center justify-center flex-1 min-w-0",
                isIOS
                  ? cn("pt-1 gap-0.5", isActive ? "text-primary" : "text-muted-foreground")
                  : cn("gap-1", isActive ? "text-foreground" : "text-muted-foreground")
              )}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center",
                  !isIOS && "h-8 w-16 rounded-full transition-colors",
                  !isIOS && isActive && "bg-primary/15"
                )}
              >
                <Icon className={isIOS ? "h-[26px] w-[26px]" : "h-6 w-6"} strokeWidth={isActive ? 2.2 : 1.8} />
                {!!badge && (
                  <span
                    className={cn(
                      "absolute z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-semibold leading-[18px] text-center",
                      isIOS ? "-top-1 -right-2.5" : "top-0 right-3"
                    )}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "truncate max-w-full",
                  isIOS ? "text-[10px] font-medium" : cn("text-xs", isActive ? "font-semibold" : "font-medium")
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
