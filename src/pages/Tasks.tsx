import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppTemplates } from "@/components/WhatsAppTemplates";
import { useUserRole } from "@/hooks/useUserRole";

interface Task {
  id: string;
  patient_id: string;
  task_type: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  patient: {
    name: string;
    phone: string;
    procedure: string;
    hospital: string | null;
    surgery_date: string | null;
    gender: string | null;
  };
}

const Tasks = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      navigate("/");
      return;
    }
    
    if (!roleLoading && isAdmin) {
      loadTasks();

      // Subscribe to realtime changes
      const channel = supabase
        .channel('patient-tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patient_tasks'
          },
          () => {
            loadTasks();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin, roleLoading, navigate]);

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from("patient_tasks")
        .select(`
          *,
          patient:patients(name, phone, procedure, hospital, surgery_date, gender)
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskCompletion(taskId: string, completed: boolean) {
    try {
      const { error } = await supabase
        .from("patient_tasks")
        .update({
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null,
          completed_by: !completed ? (await supabase.auth.getUser()).data.user?.id : null,
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success(completed ? "Tarefa reaberta" : "Tarefa concluída!");
      loadTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  }

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      exam_followup: "Cobrança de Exame",
      pre_op_instructions: "Instruções Pré-Op",
      post_op_instructions: "Recomendações Pós-Op",
      post_op_30_days: "Acompanhamento 30 Dias",
      custom: "Personalizado",
    };
    return labels[type] || type;
  };

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      exam_followup: "bg-blue-500",
      pre_op_instructions: "bg-purple-500",
      post_op_instructions: "bg-green-500",
      post_op_30_days: "bg-amber-500",
      custom: "bg-gray-500",
    };
    return colors[type] || "bg-gray-500";
  };

  const overdueTasks = tasks.filter((t) => !t.completed && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const todayTasks = tasks.filter((t) => !t.completed && isToday(new Date(t.due_date)));
  const futureTasks = tasks.filter((t) => !t.completed && isFuture(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const completedTasks = tasks.filter((t) => t.completed);

  const TaskCard = ({ task }: { task: Task }) => {
    const dueDate = new Date(task.due_date);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    return (
      <Card className={`mb-3 shadow-sm transition-all hover:shadow-md ${isOverdue ? "border-destructive border-l-4" : "border-l-4 border-l-transparent"} ${task.completed ? "opacity-75" : ""}`}>
        <CardContent className="p-3 sm:p-4">
          {/* Header: Checkbox + Badges */}
          <div className="flex items-start gap-2.5">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => toggleTaskCompletion(task.id, task.completed)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={`${getTaskTypeColor(task.task_type)} text-[10px] sm:text-xs px-1.5 py-0.5`}>
                  {getTaskTypeLabel(task.task_type)}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                    <AlertCircle className="h-3 w-3 mr-0.5" />
                    Atrasada
                  </Badge>
                )}
              </div>
              
              {/* Title */}
              <h3 className={`text-sm sm:text-base font-medium leading-snug ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h3>
              
              {/* Description - hidden on mobile if too long */}
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
              
              {/* Patient & Date - compact row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <button
                  onClick={() => navigate(`/patients/${task.patient_id}`)}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px] sm:max-w-none">{task.patient.name}</span>
                </button>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{format(dueDate, "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
              
              {/* Actions row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {task.completed && task.completed_at && (
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{format(new Date(task.completed_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {(task.task_type === "pre_op_instructions" || task.task_type === "post_op_instructions" || task.task_type === "post_op_30_days" || task.task_type === "exam_followup") && (
                  <WhatsAppTemplates
                    patient={{
                      name: task.patient.name,
                      phone: task.patient.phone || "",
                      procedure: task.patient.procedure,
                      hospital: task.patient.hospital || "",
                      surgery_date: task.patient.surgery_date || "",
                      gender: task.patient.gender || "",
                    }}
                    type={
                      task.task_type === "pre_op_instructions" 
                        ? "pre_op" 
                        : task.task_type === "post_op_instructions" 
                          ? "post_op" 
                          : task.task_type === "post_op_30_days"
                            ? "post_op_30_days"
                            : "exam_followup"
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Tarefas e Lembretes</h1>
        <p className="text-xs sm:text-base text-muted-foreground">
          Gerencie as tarefas dos pacientes
        </p>
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="overdue" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5">
            <span>Atrasadas</span>
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="text-[9px] sm:text-[10px] h-4 sm:h-5 px-1 sm:px-1.5">
                {overdueTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5">
            <span>Hoje</span>
            {todayTasks.length > 0 && (
              <Badge className="text-[9px] sm:text-[10px] h-4 sm:h-5 px-1 sm:px-1.5">{todayTasks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="future" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5">
            <span>Futuras</span>
            <span className="text-[9px] sm:text-[10px]">({futureTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5">
            <span>Concluídas</span>
            <span className="text-[9px] sm:text-[10px]">({completedTasks.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue">
          {overdueTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma tarefa atrasada! 🎉
              </CardContent>
            </Card>
          ) : (
            overdueTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </TabsContent>

        <TabsContent value="today">
          {todayTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma tarefa para hoje
              </CardContent>
            </Card>
          ) : (
            todayTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </TabsContent>

        <TabsContent value="future">
          {futureTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma tarefa futura
              </CardContent>
            </Card>
          ) : (
            futureTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma tarefa concluída
              </CardContent>
            </Card>
          ) : (
            completedTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tasks;