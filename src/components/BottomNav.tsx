import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, CalendarDays, CheckSquare } from "lucide-react";
import { endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { isNavItemActive } from "@/lib/navigation";

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

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isDentist } = useUserRole();
  const canSeeTasks = isAdmin || isDentist;
  const dueTasks = useDueTasksCount(canSeeTasks, location.pathname);

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Users, label: "Pacientes", path: "/patients" },
    { icon: CalendarDays, label: "Agenda", path: "/calendar" },
    ...(canSeeTasks
      ? [{ icon: CheckSquare, label: "Tarefas", path: "/tasks", badge: dueTasks }]
      : []),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
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
              className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              }`}
            >
              <div className={`relative flex items-center justify-center transition-all duration-200 ${
                isActive ? "scale-110" : ""
              }`}>
                {isActive && (
                  <div className="absolute inset-0 -m-2 rounded-xl bg-primary/10" />
                )}
                <Icon
                  className={`h-6 w-6 relative z-10 transition-all ${
                    isActive ? "fill-primary/20" : ""
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                {!!badge && (
                  <span className="absolute -top-2 -right-3 z-20 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1.5 ${
                isActive ? "font-bold" : "font-medium"
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
