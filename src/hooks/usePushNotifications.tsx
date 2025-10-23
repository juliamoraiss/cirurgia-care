import { useEffect } from 'react';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const usePushNotifications = () => {
  const { toast } = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    const initPushNotifications = async () => {
      try {
        // Request permission
        const { receive } = await FirebaseMessaging.requestPermissions();
        
        if (receive !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        // Get FCM token
        const { token } = await FirebaseMessaging.getToken();
        console.log('FCM token:', token);

        // Save token to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user && token) {
          const platform = Capacitor.getPlatform();
          await supabase
            .from('user_push_tokens')
            .upsert({ 
              user_id: user.id, 
              token: token,
              platform: platform === 'ios' ? 'ios' : 'android'
            });
        }

        // Listen for token refresh
        await FirebaseMessaging.addListener('tokenReceived', async (event) => {
          console.log('FCM token refreshed:', event.token);
          const { data: { user } } = await supabase.auth.getUser();
          if (user && event.token) {
            const platform = Capacitor.getPlatform();
            await supabase
              .from('user_push_tokens')
              .upsert({ 
                user_id: user.id, 
                token: event.token,
                platform: platform === 'ios' ? 'ios' : 'android'
              });
          }
        });

        // Listen for notifications received
        await FirebaseMessaging.addListener('notificationReceived', (event) => {
          console.log('Push notification received:', event.notification);
          toast({
            title: event.notification.title || 'Nova notificação',
            description: event.notification.body,
          });
        });

        // Listen for notification actions
        await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
          console.log('Notification action performed:', event);
        });

      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    initPushNotifications();

    return () => {
      FirebaseMessaging.removeAllListeners();
    };
  }, [toast]);
};
