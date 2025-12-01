import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, CalendarDays } from "lucide-react";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      icon: Home,
      label: "Home",
      path: "/",
    },
    {
      icon: Users,
      label: "Pacientes",
      path: "/patients",
    },
    {
      icon: CalendarDays,
      label: "Agenda",
      path: "/calendar",
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/70 hover:text-foreground active:scale-95"
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
              </div>
              <span className={`text-[11px] mt-1.5 tracking-wide ${
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
