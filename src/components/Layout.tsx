import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  Activity,
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Menu,
  UserPlus,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { role, loading: roleLoading, isAdmin } = useUserRole();
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
      case "user":
        return "Usuário";
      default:
        return "Sem permissão";
    }
  };

  const getRoleBadgeVariant = () => {
    switch (role) {
      case "admin":
        return "destructive";
      case "user":
        return "default";
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
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">MedSystem</h1>
            <p className="text-xs text-muted-foreground">Gestão Cirúrgica</p>
          </div>
        </div>
      </div>

      {/* Menu de navegação */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          // Esconde "Tarefas" para usuários não-admin
          if (item.path === "/tasks" && !isAdmin) {
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
          <Button
            variant={location.pathname === "/users" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => {
              navigate("/users");
              setIsOpen(false);
            }}
          >
            <UserPlus className="h-4 w-4 mr-3" />
            Gerenciar Usuários
          </Button>
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

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-sidebar border-b border-sidebar-border z-50 pt-[env(safe-area-inset-top)]">
        <div className="h-16 flex items-center px-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div 
            className="flex items-center space-x-2 ml-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-sidebar-foreground">MedSystem</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-0">
        {children}
      </main>
    </div>
  );
}