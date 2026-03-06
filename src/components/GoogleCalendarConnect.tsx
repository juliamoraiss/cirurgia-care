import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Check, Loader2, Unlink, RefreshCw } from "lucide-react";

interface GoogleCalendarConnectProps {
  onConnectionChange?: (connected: boolean) => void;
}

const GoogleCalendarConnect = ({ onConnectionChange }: GoogleCalendarConnectProps) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "status" },
      });
      if (!error && data?.connected) {
        setConnected(true);
        onConnectionChange?.(true);
      } else {
        setConnected(false);
        onConnectionChange?.(false);
      }
    } catch {
      setConnected(false);
      onConnectionChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Handle OAuth callback code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state === "google_calendar") {
      setConnecting(true);
      const redirectUri = `${window.location.origin}/calendar`;

      supabase.functions
        .invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code,
            redirect_uri: redirectUri,
          },
        })
        .then(({ data, error }) => {
          if (error || !data?.success) {
            toast.error("Erro ao conectar Google Agenda");
          } else {
            toast.success("Google Agenda conectada com sucesso!");
            setConnected(true);
            onConnectionChange?.(true);
          }
          // Clean URL
          window.history.replaceState({}, "", "/calendar");
        })
        .finally(() => setConnecting(false));
    }
  }, [onConnectionChange]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/calendar`;
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "get_auth_url", redirect_uri: redirectUri },
      });

      if (error || !data?.url) {
        toast.error("Erro ao gerar link de autorização");
        return;
      }

      // Override state param to include our marker
      const url = new URL(data.url);
      url.searchParams.set("state", "google_calendar");
      window.location.href = url.toString();
    } catch {
      toast.error("Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "disconnect" },
      });

      if (error) {
        toast.error("Erro ao desconectar");
        return;
      }

      toast.success("Google Agenda desconectada");
      setConnected(false);
      onConnectionChange?.(false);
    } catch {
      toast.error("Erro ao desconectar");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${connected ? "border-green-500/30 bg-green-500/5" : "border-dashed"}`}>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-full ${connected ? "bg-green-500/10" : "bg-muted"}`}>
            <Calendar className={`h-4 w-4 ${connected ? "text-green-600" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              Google Agenda
            </p>
            <p className="text-xs text-muted-foreground">
              {connected ? "Conectada — horários ocupados visíveis" : "Conecte para ver disponibilidade"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={connecting}
                className="text-destructive hover:text-destructive"
              >
                {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Calendar className="h-3 w-3 mr-1" />
              )}
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarConnect;
