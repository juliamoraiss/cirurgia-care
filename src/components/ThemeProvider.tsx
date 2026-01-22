import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isDentist, loading } = useUserRole();

  useEffect(() => {
    if (loading) return;

    const root = document.documentElement;
    
    if (isDentist) {
      root.classList.add("theme-dental");
    } else {
      root.classList.remove("theme-dental");
    }

    // Cleanup on unmount
    return () => {
      root.classList.remove("theme-dental");
    };
  }, [isDentist, loading]);

  return <>{children}</>;
}
