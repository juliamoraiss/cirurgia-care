import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";
import { describeError } from "@/lib/errors";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

/**
 * Notificações push (Web Push) para o app instalado na tela inicial.
 *
 * Cada aparelho que ativa o sininho cria uma inscrição real no serviço de push
 * do navegador (Apple/Google), salva em user_push_tokens. A função
 * send-task-notifications envia para essas inscrições na hora de cada tarefa.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // No iPhone, só existe PushManager quando o app foi aberto pelo ícone da tela inicial
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user || roleLoading || !isSupported || !isAdmin) return;
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, roleLoading, isSupported]);

  async function getRegistration() {
    // O service worker do PWA (sw.js) já inclui o tratamento de push
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    await navigator.serviceWorker.register("/sw.js");
    return navigator.serviceWorker.ready;
  }

  /** Ativo = este aparelho tem inscrição real E ela está salva no banco. */
  async function checkSubscription() {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }
      const { data } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("token", JSON.stringify(subscription.toJSON()))
        .maybeSingle();

      if (data) {
        setIsSubscribed(true);
      } else {
        // Inscrição existe no aparelho mas não no banco: salva de novo
        await saveSubscription(subscription);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }

  async function saveSubscription(subscription: PushSubscription) {
    if (!user) return;
    const { error } = await supabase
      .from("user_push_tokens")
      .upsert(
        { user_id: user.id, token: JSON.stringify(subscription.toJSON()), platform: "web", updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
    if (error) throw error;
  }

  async function requestPermission(): Promise<boolean> {
    if (!isSupported) {
      toast.error("Notificações não são suportadas aqui. No iPhone, abra o app pelo ícone da tela inicial.");
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") return true;
      if (result === "denied") toast.error("Permissão para notificações foi negada");
      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  }

  async function subscribe() {
    if (!user || !isSupported) return false;

    try {
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      const registration = await getRegistration();
      // Reaproveita a inscrição do aparelho, se houver; senão cria uma nova
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      await saveSubscription(subscription);

      setIsSubscribed(true);
      toast.success("Notificações ativadas! Você será avisada na hora de cada tarefa.");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error(describeError("Erro ao ativar notificações", error));
      return false;
    }
  }

  async function unsubscribe() {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // Remove só a inscrição DESTE aparelho
        await supabase
          .from("user_push_tokens")
          .delete()
          .eq("user_id", user.id)
          .eq("token", JSON.stringify(subscription.toJSON()));
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success("Notificações desativadas neste aparelho");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error(describeError("Erro ao desativar notificações", error));
      return false;
    }
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    canSubscribe: isSupported && isAdmin,
  };
}

// Converte a chave VAPID (base64url) para o formato que o navegador espera
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
