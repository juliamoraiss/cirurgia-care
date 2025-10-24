import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTokenToBackend = async (deviceToken: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ Usuário não autenticado, token não salvo');
        return;
      }

      console.log('💾 Salvando token no backend...');

      // Salvar token na tabela push_tokens
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token: deviceToken,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'token'
        });

      if (error) {
        console.error('❌ Erro ao salvar token:', error);
      } else {
        console.log('✅ Token salvo no backend com sucesso!');
      }
    } catch (err) {
      console.error('❌ Erro ao salvar token:', err);
    }
  };

  useEffect(() => {
    // Não registrar no web
    if (Capacitor.getPlatform() === 'web') {
      console.log('ℹ️ Push notifications não disponíveis na web');
      return;
    }

    const registerNotifications = async () => {
      try {
        console.log('🔔 Iniciando registro de notificações...');
        
        // Verificar permissões
        let permStatus = await PushNotifications.checkPermissions();
        console.log('📋 Status de permissões:', permStatus);

        if (permStatus.receive === 'prompt') {
          console.log('❓ Solicitando permissão...');
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('❌ Permissão negada');
          setError('Permissão negada');
          return;
        }

        console.log('✅ Permissão concedida, registrando...');
        
        // Registrar para notificações
        await PushNotifications.register();
        console.log('✅ Registro de push notifications iniciado');

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMsg);
        console.error('❌ Erro ao registrar:', err);
      }
    };

    // Listener para token registrado com sucesso
    PushNotifications.addListener('registration', (tokenData) => {
      console.log('🎉 Token registrado com sucesso!');
      console.log('🔑 Token:', tokenData.value);
      setToken(tokenData.value);
      saveTokenToBackend(tokenData.value);
    });

    // Listener para erro no registro
    PushNotifications.addListener('registrationError', (err) => {
      console.error('❌ Erro no registro de token:', err);
      setError(JSON.stringify(err));
    });

    // Listener para notificação recebida (app aberto)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📱 Notificação recebida (app aberto):', notification);
    });

    // Listener para notificação clicada
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Notificação clicada:', notification);
    });

    // Iniciar registro
    registerNotifications();

    // Cleanup ao desmontar
    return () => {
      console.log('🧹 Removendo listeners de notificações');
      PushNotifications.removeAllListeners();
    };
  }, []);

  return { token, error };
};