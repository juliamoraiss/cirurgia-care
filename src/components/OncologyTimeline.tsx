import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Stethoscope, 
  FileText, 
  Pill, 
  Calendar, 
  CheckCircle, 
  Plus, 
  Trash2,
  Activity,
  AlertCircle,
  HeartPulse
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface OncologyEvent {
  id: string;
  patient_id: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

interface OncologyTimelineProps {
  patientId: string;
  patientName?: string;
}

const eventTypeConfig: Record<string, { 
  icon: typeof Stethoscope; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  diagnosis: { 
    icon: AlertCircle, 
    color: "text-red-500", 
    bgColor: "bg-red-500/10",
    label: "Diagnóstico" 
  },
  exam: { 
    icon: FileText, 
    color: "text-blue-500", 
    bgColor: "bg-blue-500/10",
    label: "Exame" 
  },
  treatment_start: { 
    icon: Pill, 
    color: "text-purple-500", 
    bgColor: "bg-purple-500/10",
    label: "Início de Tratamento" 
  },
  consultation: { 
    icon: Stethoscope, 
    color: "text-cyan-500", 
    bgColor: "bg-cyan-500/10",
    label: "Consulta" 
  },
  surgery: { 
    icon: HeartPulse, 
    color: "text-success", 
    bgColor: "bg-success/10",
    label: "Cirurgia" 
  },
  follow_up: { 
    icon: Calendar, 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    label: "Acompanhamento" 
  },
  remission: { 
    icon: CheckCircle, 
    color: "text-green-500", 
    bgColor: "bg-green-500/10",
    label: "Remissão" 
  },
  other: { 
    icon: Activity, 
    color: "text-muted-foreground", 
    bgColor: "bg-muted",
    label: "Outro" 
  },
};

export function OncologyTimeline({ patientId, patientName }: OncologyTimelineProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [events, setEvents] = useState<OncologyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    event_type: "consultation",
    title: "",
    description: "",
    event_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    loadEvents();
  }, [patientId]);

  async function loadEvents() {
    try {
      const { data, error } = await supabase
        .from("oncology_timeline")
        .select("*")
        .eq("patient_id", patientId)
        .order("event_date", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading oncology timeline:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim()) {
      toast.error("Informe o título do evento");
      return;
    }

    try {
      const { error } = await supabase.from("oncology_timeline").insert({
        patient_id: patientId,
        event_type: formData.event_type,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_date: new Date(formData.event_date).toISOString(),
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Evento adicionado à timeline");
      setFormData({
        event_type: "consultation",
        title: "",
        description: "",
        event_date: new Date().toISOString().slice(0, 10),
      });
      setIsDialogOpen(false);
      loadEvents();
    } catch (error) {
      toast.error("Erro ao adicionar evento");
      console.error(error);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      const { error } = await supabase
        .from("oncology_timeline")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success("Evento removido");
    } catch (error) {
      toast.error("Erro ao remover evento");
      console.error(error);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Timeline Oncológica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Timeline Oncológica
            </CardTitle>
            <CardDescription>
              Acompanhamento detalhado do tratamento oncológico
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Evento na Timeline</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Evento</Label>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, event_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className={`h-4 w-4 ${config.color}`} />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Biópsia realizada"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Detalhes adicionais sobre o evento..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Adicionar Evento
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum evento registrado ainda</p>
            <p className="text-sm mt-1">Adicione eventos para acompanhar o tratamento</p>
          </div>
        ) : (
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {events.map((event) => {
                const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
                const Icon = config.icon;

                return (
                  <div key={event.id} className="relative flex gap-4 group">
                    {/* Ícone na timeline */}
                    <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor} border-2 border-background shadow-sm`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    {/* Conteúdo do evento */}
                    <div className="flex-1 pb-4">
                      <div className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                            <h4 className="font-semibold mt-1.5">{event.title}</h4>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                {event.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Adicionado {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                          
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={() => handleDelete(event.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
