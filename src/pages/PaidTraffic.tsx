import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Users, Calendar, UserCheck, UserX, Clock, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function PaidTraffic() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { data: reports, refetch } = useQuery({
    queryKey: ["paid-traffic-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paid_traffic_reports")
        .select("*")
        .order("report_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, envie apenas arquivos PDF");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user?.id || "");

      const { data, error } = await supabase.functions.invoke("analyze-traffic-pdf", {
        body: formData,
      });

      if (error) throw error;

      toast.success("Relatório analisado e salvo com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao processar PDF:", error);
      toast.error("Erro ao processar PDF: " + error.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const formatNumber = (value: number | null) => {
    if (!value) return "0";
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return "Período não especificado";
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Tráfego Pago</h1>
          <div>
            <Input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload">
              <Button disabled={uploading} asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Processando..." : "Enviar Relatório PDF"}
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div className="grid gap-6">
          {reports?.map((report) => (
            <Card key={report.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Relatório de Leads</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPeriod(report.period_start, report.period_end)}
                  </p>
                  {report.concierge_name && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Concierge: {report.concierge_name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total de Leads</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatNumber(report.total_leads)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-sm">Agendados</span>
                  </div>
                  <p className="text-lg font-semibold text-green-600">
                    {formatNumber(report.scheduled_appointments)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserX className="h-4 w-4" />
                    <span className="text-sm">Não Agendados</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatNumber(report.not_scheduled)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Aguardando</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatNumber(report.awaiting_response)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">Sem Continuidade</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatNumber(report.no_continuity)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">Sem Contato</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatNumber(report.no_contact_after_attempts)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">Fora de Brasília</span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatNumber(report.leads_outside_brasilia)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Leads Ativos</span>
                  </div>
                  <p className="text-lg font-semibold text-blue-600">
                    {formatNumber(report.active_leads)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Em Progresso</span>
                  </div>
                  <p className="text-lg font-semibold text-orange-600">
                    {formatNumber(report.in_progress)}
                  </p>
                </div>
              </div>

              {report.pdf_file_name && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Arquivo: {report.pdf_file_name}
                  </p>
                </div>
              )}
            </Card>
          ))}

          {reports?.length === 0 && (
            <Card className="p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum relatório encontrado
              </h3>
              <p className="text-muted-foreground">
                Envie um PDF com seu relatório de leads para começar
              </p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}