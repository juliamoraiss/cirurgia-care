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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

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
      custom: "Personalizado",
    };
    return labels[type] || type;
  };

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      exam_followup: "bg-blue-500",
      pre_op_instructions: "bg-purple-500",
      post_op_instructions: "bg-green-500",
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
      <Card className={`mb-4 ${isOverdue ? "border-red-500" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTaskCompletion(task.id, task.completed)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getTaskTypeColor(task.task_type)}>
                    {getTaskTypeLabel(task.task_type)}
                  </Badge>
                  {isOverdue && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Atrasada
                    </Badge>
                  )}
                </div>
                <CardTitle className={`text-lg ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </CardTitle>
                {task.description && (
                  <CardDescription className="mt-1">{task.description}</CardDescription>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-4 w-4" />
                <button
                  onClick={() => navigate(`/patients/${task.patient_id}`)}
                  className="hover:underline"
                >
                  {task.patient.name}
                </button>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {format(dueDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.completed && task.completed_at && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Concluída em {format(new Date(task.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
              {(task.task_type === "pre_op_instructions" || task.task_type === "post_op_instructions") && (
                <WhatsAppTemplates
                  patient={{
                    name: task.patient.name,
                    phone: task.patient.phone || "",
                    procedure: task.patient.procedure,
                    hospital: task.patient.hospital || "",
                    surgery_date: task.patient.surgery_date || "",
                    gender: task.patient.gender || "",
                  }}
                  type={task.task_type === "pre_op_instructions" ? "pre_op" : "post_op"}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tarefas e Lembretes</h1>
        <p className="text-muted-foreground">
          Gerencie todas as tarefas e lembretes dos pacientes
        </p>
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overdue" className="relative">
            Atrasadas
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overdueTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="relative">
            Hoje
            {todayTasks.length > 0 && (
              <Badge className="ml-2">{todayTasks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="future">
            Futuras ({futureTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Concluídas ({completedTasks.length})
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