import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  approved: boolean;
}

const PendingUsers = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Redirect non-admins
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      // Admin can view all profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at, approved")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingUser[];
    },
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
                  <div>
                    <CardTitle className="text-lg">{pendingUser.full_name}</CardTitle>
                    <CardDescription>{pendingUser.email}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pendente
                  </Badge>
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
