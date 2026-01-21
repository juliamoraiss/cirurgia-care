import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Users, Clock, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  approved: boolean;
  user_type: "medico" | "dentista" | null;
}

const PendingUsers = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      // Admin can view all profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at, approved, user_type")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingUser[];
    },
    enabled: isAdmin, // Only fetch if user is admin
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          approved: true, 
          approved_at: new Date().toISOString(),
          approved_by: user?.id 
        })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário aprovado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
    },
    onError: () => {
      toast.error("Erro ao aprovar usuário.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete the user from auth.users (which cascades to profiles and user_roles)
      // This requires an edge function since we can't directly delete from auth.users
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário rejeitado e removido.");
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
    },
    onError: () => {
      toast.error("Erro ao rejeitar usuário.");
    },
  });

  // Redirect non-admins AFTER all hooks are called
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Usuários Pendentes
            </h1>
            <p className="text-muted-foreground">
              Aprove ou rejeite novos cadastros
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : pendingUsers && pendingUsers.length > 0 ? (
        <div className="grid gap-4">
          {pendingUsers.map((pendingUser) => (
            <Card key={pendingUser.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${pendingUser.user_type === 'dentista' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {pendingUser.user_type === 'dentista' ? (
                        <svg 
                          className="h-5 w-5 text-blue-600"
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2 1 3.5 2 4.5-.5 2-1.5 6-1 8 .5 2 2 2.5 3 2.5s2-.5 2-2v-3c0-.5.5-1 1-1s1 .5 1 1v3c0 1.5 1 2 2 2s2.5-.5 3-2.5c.5-2-.5-6-1-8 1-1 2-2.5 2-4.5C20 4.5 17.5 2 14 2h-2z" />
                        </svg>
                      ) : (
                        <Stethoscope className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{pendingUser.full_name}</CardTitle>
                      <CardDescription>{pendingUser.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={pendingUser.user_type === 'dentista' ? 'default' : 'secondary'}>
                      {pendingUser.user_type === 'dentista' ? 'Dentista' : pendingUser.user_type === 'medico' ? 'Médico' : 'Não informado'}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Cadastrado em {format(new Date(pendingUser.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(pendingUser.id)}
                      disabled={rejectMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(pendingUser.id)}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum usuário pendente</p>
              <p className="text-sm">Novos cadastros aparecerão aqui para aprovação.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PendingUsers;
