import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  ChevronRight,
  LogOut,
  MessageCircle,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

/** Grupo de linhas: "inset grouped" no iOS, lista com título no Android. */
function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      {title && (
        <h2
          className={cn(
            "px-4 text-[13px] font-normal text-muted-foreground",
            isIOS ? "uppercase tracking-wide" : "normal-case text-primary font-medium text-sm"
          )}
        >
          {title}
        </h2>
      )}
      {/* Separador "inset" entre as linhas; a última não tem */}
      <div className={cn("bg-card overflow-hidden [&>*:last-child_.row-sep]:border-b-0", isIOS ? "mx-4 rounded-xl" : "")}>
        {children}
      </div>
      {footer && <p className="px-4 text-[13px] text-muted-foreground">{footer}</p>}
    </section>
  );
}

function Row({
  icon,
  label,
  detail,
  onClick,
  trailing,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 pl-4 text-left min-h-11 android:min-h-14",
        onClick && "active:bg-muted",
        destructive ? "text-destructive" : "text-foreground"
      )}
    >
      <span className="shrink-0 text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="row-sep flex-1 min-w-0 flex items-center gap-2 py-2.5 pr-4 border-b border-border/60">
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] android:text-base truncate">{label}</span>
          {detail && <span className="block text-[13px] text-muted-foreground truncate">{detail}</span>}
        </span>
        {trailing ?? (onClick && !destructive && isIOS ? <ChevronRight className="h-5 w-5 text-muted-foreground/60" /> : null)}
      </span>
    </Comp>
  );
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", doctor: "Médico" };

/** Aba "Mais" do celular: itens que antes ficavam no menu ☰ e no cabeçalho. */
export default function More() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, role } = useUserRole();
  const push = usePushNotifications();

  return (
    <div className="pb-6">
      <PageHeader title="Mais" />

      <div className="space-y-6 pt-2">
        {/* Perfil */}
        <Group title="Conta">
          <Row
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold uppercase">
                {user?.email?.charAt(0) || "U"}
              </span>
            }
            label={user?.email ?? ""}
            detail={role ? ROLE_LABEL[role] ?? role : undefined}
          />
        </Group>

        {/* Notificações */}
        {push.canSubscribe || isAdmin ? (
          <Group
            title="Notificações"
            footer={
              !push.isSupported
                ? isIOS
                  ? "No iPhone, as notificações só funcionam com o app aberto pelo ícone da tela inicial."
                  : "Este navegador não suporta notificações."
                : push.permission === "denied"
                ? "Notificações bloqueadas. Libere nos ajustes do aparelho."
                : "Aviso no celular na hora de cada tarefa."
            }
          >
            <Row
              icon={<Bell />}
              label="Notificações das tarefas"
              trailing={
                <Switch
                  checked={push.isSubscribed}
                  disabled={!push.isSupported || push.permission === "denied"}
                  onCheckedChange={(checked) => (checked ? push.subscribe() : push.unsubscribe())}
                  aria-label="Notificações das tarefas"
                />
              }
            />
          </Group>
        ) : null}

        {isAdmin && (
          <Group title="Atalhos">
            <Row icon={<MessageCircle />} label="Importar do WhatsApp" onClick={() => navigate("/share-cirurgia")} />
            <Row icon={<CalendarClock />} label="Disponibilidade cirúrgica" onClick={() => navigate("/surgery-availability")} />
            <Row icon={<TrendingUp />} label="Tráfego Pago" onClick={() => navigate("/paid-traffic")} />
          </Group>
        )}

        {isAdmin && (
          <Group title="Usuários">
            <Row icon={<UserCheck />} label="Usuários pendentes" onClick={() => navigate("/pending-users")} />
            <Row icon={<UserPlus />} label="Criar usuário" onClick={() => navigate("/users")} />
          </Group>
        )}

        <Group>
          <Row icon={<LogOut />} label="Sair" onClick={() => signOut()} destructive />
        </Group>
      </div>
    </div>
  );
}
