import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NotificationToggle() {
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    subscribe, 
    unsubscribe,
    canSubscribe,
  } = usePushNotifications();

  if (!canSubscribe) {
    return null;
  }

  if (!isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled className="opacity-50">
            <BellOff className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notificações não suportadas neste navegador</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (permission === "denied") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled className="opacity-50">
            <BellOff className="h-5 w-5 text-destructive" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notificações bloqueadas. Habilite nas configurações do navegador.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClick}
          className={isSubscribed ? "text-primary" : ""}
        >
          {isSubscribed ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isSubscribed 
            ? "Notificações ativas - clique para desativar" 
            : "Ativar notificações diárias de tarefas"
          }
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
