import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PendingApproval = () => {
  const { user, loading, isApproved, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  // If not logged in, redirect to auth
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // If approved, redirect to home
  if (!loading && user && isApproved) {
    return <Navigate to="/" replace />;
  }

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data } = await supabase
        .rpc('is_user_approved', { _user_id: user?.id });
      
      if (data === true) {
        toast.success("Sua conta foi aprovada! Redirecionando...");
        // Force page reload to update auth state
        window.location.href = "/";
      } else {
        toast.info("Sua conta ainda está aguardando aprovação.");
      }
    } catch (error) {
      toast.error("Erro ao verificar status.");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Aguardando Aprovação</CardTitle>
          <CardDescription>
            Sua conta foi criada com sucesso!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            <p>Um administrador precisa aprovar seu acesso antes de você poder usar o sistema.</p>
            <p className="mt-2 text-sm">Você receberá acesso assim que sua conta for aprovada.</p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={handleCheckStatus} 
              variant="outline" 
              className="w-full"
              disabled={checking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              {checking ? "Verificando..." : "Verificar Status"}
            </Button>
            
            <Button 
              onClick={signOut} 
              variant="ghost" 
              className="w-full text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Email cadastrado: {user?.email}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
