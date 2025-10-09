import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppTemplates } from "./WhatsAppTemplates";

interface Task {
  id: string;
  task_type: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
}

interface Patient {
  name: string;
  phone: string;
  procedure: string;
  hospital: string;
  surgery_date: string;
  gender: string;
}

interface PatientTasksSectionProps {
  patientId: string;
}

export function PatientTasksSection({ patientId }: PatientTasksSectionProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    task_type: "custom",
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    loadTasks();
    loadPatient();
  }, [patientId]);

  async function loadPatient() {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("name, phone, procedure, hospital, surgery_date, gender")
        .eq("id", patientId)
        .single();

      if (error) throw error;
      setPatient(data);
    } catch (error) {
      console.error("Error loading patient:", error);
    }
  }

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from("patient_tasks")
        .select("*")
        .eq("patient_id", patientId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
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
          completed_by: !completed ? user?.id : null,
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success(completed ? "Tarefa reaberta" : "Tarefa concluída!");
      loadTasks();
    } catch (error) {
      toast.error("Erro ao atualizar tarefa");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const { error } = await supabase
        .from("patient_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Tarefa excluída com sucesso!");
      loadTasks();
    } catch (error) {
      toast.error("Erro ao excluir tarefa");
    }
  }

  async function createTask() {
    if (!newTask.title || !newTask.due_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("patient_tasks").insert({
        patient_id: patientId,
        task_type: newTask.task_type,
        title: newTask.title,
        description: newTask.description,
        due_date: new Date(newTask.due_date).toISOString(),
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setDialogOpen(false);
      setNewTask({
        task_type: "custom",
        title: "",
        description: "",
        due_date: "",
      });
      loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    }
  }

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      exam_followup: "Cobrança de Exames",
      pre_op_instructions: "Instruções Pré-Op",
      post_op_instructions: "Recomendações Pós-Op",
      custom: "Personalizado",
    };
    return labels[type] || type;
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  if (loading) {
    return <div className="text-center py-4">Carregando tarefas...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tarefas e Lembretes</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Tarefa</DialogTitle>
                <DialogDescription>
                  Adicione um lembrete ou tarefa para este paciente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task_type">Tipo de Tarefa</Label>
                  <Select
                    value={newTask.task_type}
                    onValueChange={(value) =>
                      setNewTask({ ...newTask, task_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizado</SelectItem>
                      <SelectItem value="exam_followup">
                        Cobrança de Exames
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) =>
                      setNewTask({ ...newTask, title: e.target.value })
                    }
                    placeholder="Ex: Cobrar resultado do exame X"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) =>
                      setNewTask({ ...newTask, description: e.target.value })
                    }
                    placeholder="Detalhes adicionais..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Data e Hora *</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={newTask.due_date}
                    onChange={(e) =>
                      setNewTask({ ...newTask, due_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createTask}>Criar Tarefa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhuma tarefa para este paciente
          </p>
        ) : (
          <div className="space-y-4">
            {pendingTasks.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Pendentes</h4>
                <div className="space-y-2">
                  {pendingTasks.map((task) => {
                    const dueDate = new Date(task.due_date);
                    const isOverdue = isPast(dueDate) && !isToday(dueDate);

                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          isOverdue ? "border-red-500 bg-red-50" : "bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={false}
                          onCheckedChange={() =>
                            toggleTaskCompletion(task.id, false)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {getTaskTypeLabel(task.task_type)}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Atrasada
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Vence em:{" "}
                                {format(dueDate, "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                          {(task.task_type === "custom" || task.task_type === "exam_followup" || task.task_type === "pre_op_instructions" || task.task_type === "post_op_instructions") && patient && (
                            <div className="mt-3">
                              <WhatsAppTemplates 
                                patient={patient} 
                                type={
                                  task.task_type === "post_op_instructions" 
                                    ? "post_op" 
                                    : task.task_type === "exam_followup" 
                                    ? "exam_followup" 
                                    : "pre_op"
                                } 
                                examName={task.task_type === "exam_followup" ? task.title : undefined}
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Concluídas</h4>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() =>
                          toggleTaskCompletion(task.id, true)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Badge variant="outline" className="text-xs mb-1">
                          {getTaskTypeLabel(task.task_type)}
                        </Badge>
                        <p className="font-medium line-through text-muted-foreground">
                          {task.title}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTask(task.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}