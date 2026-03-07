import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Calendar, Check, Loader2, Unlink } from "lucide-react";

interface GoogleCalendarConnectProps {
  onConnectionChange?: (connected: boolean) => void;
}

const GoogleCalendarConnect = ({ onConnectionChange }: GoogleCalendarConnectProps) => {
  const { session, loading: authLoading } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const exchangedRef = useRef(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "status" },
      });

      const isConnected = !error && !!data?.connected;
      setConnected(isConnected);
      onConnectionChange?.(isConnected);
      return isConnected;
    } catch {
      setConnected(false);
      onConnectionChange?.(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const extractFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
    const maybeError = error as {
      message?: string;
      context?: { json?: () => Promise<any>; text?: () => Promise<string> };
    };

    if (maybeError?.context?.json) {
      try {
        const parsed = await maybeError.context.json();
        if (parsed?.error) return String(parsed.error);
      } catch {
        // noop
      }
    }

    if (maybeError?.context?.text) {
      try {
        const text = await maybeError.context.text();
        if (text) return text;
      } catch {
        // noop
      }
    }

    return maybeError?.message || null;
  };

  // Handle OAuth callback code - read from sessionStorage (saved in main.tsx before Supabase intercepts)
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (exchangedRef.current) return;

    // Check sessionStorage first (saved before Supabase could consume the URL param)
    const code = sessionStorage.getItem("google_calendar_code");
    
    // Also check URL params as fallback
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    const oauthError = params.get("error");

    if (oauthError) {
      toast.error("Autorização do Google recusada ou inválida");
      window.history.replaceState({}, "", "/calendar");
      return;
    }

    const finalCode = code || urlCode;
    if (!finalCode) return;

    // Mark as processed immediately
    exchangedRef.current = true;
    sessionStorage.removeItem("google_calendar_code");
    window.history.replaceState({}, "", "/calendar");

    setConnecting(true);
    const redirectUri = `${window.location.origin}/calendar`;

    const exchangeCode = async () => {
      try {
        console.log("[GoogleCalendar] Exchanging code with valid session...");
        const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
          body: {
            action: "exchange_code",
            code: finalCode,
            redirect_uri: redirectUri,
          },
        });

        console.log("[GoogleCalendar] exchange_code response:", { data, error });

        if (error || !data?.success) {
          const detailedError = (data as { error?: string } | null)?.error || await extractFunctionErrorMessage(error);
          const errorMsg = detailedError || "Erro ao conectar Google Agenda";
          console.error("[GoogleCalendar] ERRO:", errorMsg);
          toast.error(errorMsg);
          return;
        }

        const connectedNow = await checkConnection();
        if (connectedNow) {
          toast.success("Google Agenda conectada com sucesso!");
        } else {
          toast.error("Conexão concluída, mas a agenda não ficou vinculada. Tente reconectar.");
        }
      } catch (err) {
        console.error("[GoogleCalendar] Exception:", err);
        toast.error("Erro inesperado ao conectar Google Agenda");
      } finally {
        setConnecting(false);
      }
    };

    void exchangeCode();
  }, [authLoading, session, checkConnection]);

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

