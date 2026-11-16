import { useEffect, useState } from 'react';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const useFirebasePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTokenToBackend = async (fcmToken: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ Usuário não autenticado, token não salvo');
        return;
      }

      console.log('💾 Salvando token FCM no backend...');

      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token: fcmToken,
          platform: 'fcm',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'token'
        });

      if (error) {
        console.error('❌ Erro ao salvar token:', error);
      } else {
        console.log('✅ Token FCM salvo no backend com sucesso!');
      }
    } catch (err) {
      console.error('❌ Erro ao salvar token:', err);
    }
  };

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') {
      console.log('ℹ️ Firebase Messaging não disponível na web');
      return;
    }

    const registerFirebaseMessaging = async () => {
      try {
        console.log('🔥 Iniciando registro Firebase Messaging...');
        
        const result = await FirebaseMessaging.requestPermissions();
        console.log('📋 Permissões Firebase:', result);

        if (result.receive === 'granted') {
          console.log('✅ Permissão concedida, obtendo token...');
          
          const { token: fcmToken } = await FirebaseMessaging.getToken();
          console.log('🎉 Token FCM obtido!');
          console.log('🔑 Token:', fcmToken);
          
          setToken(fcmToken);
          saveTokenToBackend(fcmToken);
        } else {
          console.log('❌ Permissão negada');
          setError('Permissão negada');
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMsg);
        console.error('❌ Erro ao registrar Firebase:', err);
      }
    };

    FirebaseMessaging.addListener('tokenReceived', (event) => {
      console.log('🔄 Token FCM atualizado:', event.token);
      setToken(event.token);
      saveTokenToBackend(event.token);
    });

    FirebaseMessaging.addListener('notificationReceived', (event) => {
      console.log('📱 Notificação recebida (app aberto):', event.notification);
    });

    FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      console.log('👆 Notificação clicada:', event.notification);
    });

    registerFirebaseMessaging();

    return () => {
      console.log('🧹 Removendo listeners Firebase');
      FirebaseMessaging.removeAllListeners();
    };
  }, []);

  return { token, error };
};