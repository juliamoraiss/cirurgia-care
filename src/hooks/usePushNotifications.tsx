import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
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
        const result = await PushNotifications.requestPermissions();
        
        if (result.receive !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration success
        await PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user && token.value) {
            const platform = Capacitor.getPlatform();
            await supabase
              .from('user_push_tokens')
              .upsert({ 
                user_id: user.id, 
                token: token.value,
                platform: platform === 'ios' ? 'ios' : 'android'
              });
          }
        });

        // Listen for registration errors
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Listen for notifications received
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
          toast({
            title: notification.title || 'Nova notificação',
            description: notification.body,
          });
        });

        // Listen for notification actions
        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Notification action performed:', notification);
        });

      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    initPushNotifications();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [toast]);
};
