import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  Stethoscope,
  Smile,
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Menu,
  UserPlus,
  CheckSquare,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { role, loading: roleLoading, isAdmin, isDentist } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/",
    },
    {
      icon: Users,
      label: "Pacientes",
      path: "/patients",
    },
    {
      icon: Calendar,
      label: "Agenda",
      path: "/calendar",
    },
    {
      icon: CheckSquare,
      label: "Tarefas",
      path: "/tasks",
    },
    {
      icon: TrendingUp,
      label: "Tráfego Pago",
      path: "/paid-traffic",
    },
  ];

  const getRoleLabel = () => {
    if (roleLoading) return "Carregando...";
    switch (role) {
      case "admin":
        return "Administrador";
      case "doctor":
        return "Médico";
      case "dentist":
        return "Dentista";
      default:
        return "Sem permissão";
    }
  };

  const getRoleBadgeVariant = () => {
    switch (role) {
      case "admin":
        return "destructive";
      case "doctor":
        return "default";
      case "dentist":
        return "secondary";
      default:
        return "outline";
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header com espaçamento adequado e espaço para o botão X */}
      <div className="p-6 pt-12 border-b border-sidebar-border pr-12">
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            navigate("/");
            setIsOpen(false);
          }}
        >
          <div className="p-2 bg-primary rounded-lg">
            {isDentist ? (
              <Smile className="h-6 w-6 text-primary-foreground" />
            ) : (
              <Stethoscope className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">
              {isDentist ? "DentSystem" : "MedSystem"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isDentist ? "Gestão de Pacientes" : "Gestão Cirúrgica"}
            </p>
          </div>
        </div>
      </div>

      {/* Menu de navegação */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          // Esconde "Tarefas" para doctors (médicos) - dentistas e admins podem ver
          if (item.path === "/tasks" && !isAdmin && !isDentist) {
            return null;
          }
          
          // Esconde "Tráfego Pago" para todos exceto admins
          if (item.path === "/paid-traffic" && !isAdmin) {
            return null;
          }
          
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                navigate(item.path);
                setIsOpen(false);
              }}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
            </Button>
          );
        })}
        
        {isAdmin && (
          <>
            <Button
              variant={location.pathname === "/pending-users" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                navigate("/pending-users");
                setIsOpen(false);
              }}
            >
              <UserCheck className="h-4 w-4 mr-3" />
              Usuários Pendentes
            </Button>
            <Button
              variant={location.pathname === "/users" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                navigate("/users");
                setIsOpen(false);
              }}
            >
              <UserPlus className="h-4 w-4 mr-3" />
              Criar Usuário
            </Button>
          </>
        )}
      </nav>

      {/* Footer com informações do usuário */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="px-2 py-1">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {user?.email?.split('@')[0]}
          </p>
          <Badge variant={getRoleBadgeVariant()} className="mt-2">
            {getRoleLabel()}
          </Badge>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            signOut();
            setIsOpen(false);
          }}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 border-r border-sidebar-border bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Header - Native Style */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md z-50 pt-[env(safe-area-inset-top)]">
        <div className="h-14 flex items-center justify-between px-3">
          {/* Left: Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          
          {/* Center: Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <div className="p-1.5 bg-primary/10 rounded-lg">
              {isDentist ? (
                <Smile className="h-4 w-4 text-primary" />
              ) : (
                <Stethoscope className="h-4 w-4 text-primary" />
              )}
            </div>
            <span className="font-semibold text-sm text-foreground">
              {isDentist ? "DentSystem" : "MedSystem"}
            </span>
          </div>
          
          {/* Right: Profile */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-full bg-muted/50"
            onClick={() => setIsOpen(true)}
          >
            <span className="text-xs font-bold text-muted-foreground uppercase">
              {user?.email?.charAt(0) || "U"}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Navigation */}
      <BottomNav />
      <FAB />
    </div>
  );
}