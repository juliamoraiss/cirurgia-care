import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user } = useAuth();
  const { isAdmin, isDentist, loading: roleLoading } = useUserRole();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if push notifications are supported
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user || roleLoading || !isSupported) return;
    
    // Only subscribe for admins and dentists
    if (!isAdmin && !isDentist) return;

    checkSubscription();
  }, [user, isAdmin, isDentist, roleLoading, isSupported]);

  async function checkSubscription() {
    if (!user) return;

    try {
      // First check localStorage for quick UI feedback
      const localSubscribed = localStorage.getItem("push_subscribed") === "true";
      if (localSubscribed) {
        setIsSubscribed(true);
      }

      // Then verify with database
      const { data, error } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", "web")
        .maybeSingle();

      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }

      const hasToken = !!data;
      setIsSubscribed(hasToken);
      
      // Sync localStorage with database
      if (hasToken) {
        localStorage.setItem("push_subscribed", "true");
      } else {
        localStorage.removeItem("push_subscribed");
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!isSupported) {
      toast.error("Notificações não são suportadas neste navegador");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        return true;
      } else if (result === "denied") {
        toast.error("Permissão para notificações foi negada");
        return false;
      }
      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  }

  async function subscribe() {
    if (!user || !isSupported) return false;

    try {
      // Request permission first
      if (permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Generate a unique device identifier for this browser
      let deviceId = localStorage.getItem("push_device_id");
      if (!deviceId) {
        deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("push_device_id", deviceId);
      }

      // Store the device registration in the database
      // We use a simple token that includes the device ID since we can't use full Web Push without VAPID
      const token = JSON.stringify({
        deviceId,
        registeredAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      
      // Check if token already exists for this user and platform
      const { data: existing } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", "web")
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from("user_push_tokens")
          .update({ token, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        error = result.error;
      } else {
        const result = await supabase.from("user_push_tokens").insert({
          user_id: user.id,
          token,
          platform: "web",
        });
        error = result.error;
      }

      if (error) {
        console.error("Error saving push token:", error);
        toast.error("Erro ao salvar configuração de notificações");
        return false;
      }

      // Also save subscription status to localStorage for quick UI feedback
      localStorage.setItem("push_subscribed", "true");
      
      setIsSubscribed(true);
      toast.success("Notificações ativadas com sucesso!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Erro ao ativar notificações");
      return false;
    }
  }

  async function unsubscribe() {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      const { error } = await supabase
        .from("user_push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("platform", "web");

      if (error) {
        console.error("Error deleting push token:", error);
      }

      // Clear localStorage
      localStorage.removeItem("push_subscribed");
      localStorage.removeItem("push_device_id");

      setIsSubscribed(false);
      toast.success("Notificações desativadas");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Erro ao desativar notificações");
      return false;
    }
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    canSubscribe: isSupported && (isAdmin || isDentist),
  };
}

// Helper function to convert VAPID key
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
