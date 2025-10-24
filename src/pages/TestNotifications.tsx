import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function TestNotifications() {
  const { toast } = useToast();
  const [title, setTitle] = useState('Teste de Notificação');
  const [body, setBody] = useState('Esta é uma notificação de teste do sistema.');
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkTokens();
  }, []);

  const checkTokens = async () => {
    try {
      setChecking(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', user.id);

      if (!error && data) {
        setTokenCount(data.length);
        setHasToken(data.length > 0);
        console.log(`✅ ${data.length} token(s) encontrado(s)`);
      }
    } catch (error) {
      console.error('Erro ao verificar tokens:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleSendNotification = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar autenticado',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          title,
          body,
        },
      });

      if (error) throw error;

      toast({
        title: 'Notificação enviada!',
        description: `${data.successful} token(s) notificado(s)`,
      });

      console.log('Notification result:', data);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            <CardTitle>Teste de Notificações Push</CardTitle>
          </div>
          <CardDescription>
            Envie uma notificação de teste para o seu dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status do Token */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            hasToken 
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' 
              : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
          }`}>
            {hasToken ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {tokenCount} token(s) registrado(s) ✅
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Nenhum token registrado ⚠️
                </span>
              </>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkTokens} 
              disabled={checking}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da notificação"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Corpo da notificação"
              rows={4}
            />
          </div>

          <Button 
            onClick={handleSendNotification} 
            disabled={loading || !title || !body || !hasToken}
            className="w-full"
          >
            {loading ? 'Enviando...' : 'Enviar Notificação de Teste'}
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 border-t pt-3">
            <p className="font-medium">⚙️ Checklist:</p>
            <p>• Certifique-se de que você permitiu notificações no app</p>
            <p>• O token do dispositivo deve estar registrado no sistema</p>
            <p>• Para iOS, você precisa estar em um dispositivo físico</p>
            {!hasToken && (
              <p className="text-yellow-600 dark:text-yellow-400 font-medium mt-2">
                ⚠️ Abra o app no dispositivo para registrar o token!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}