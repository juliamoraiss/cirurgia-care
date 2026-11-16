import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { describeError } from "@/lib/errors";

/** Tipos de tarefa que são resolvidos enviando uma mensagem de WhatsApp. */
export const MESSAGE_TASK_TYPES = [
  "pre_op_instructions",
  "post_op_instructions",
  "post_op_30_days",
  "exam_followup",
  "cannula_reminder",
  "surgery_confirmation_patient",
  "surgery_confirmation_doctor",
] as const;

export function isMessageTask(taskType: string) {
  return (MESSAGE_TASK_TYPES as readonly string[]).includes(taskType);
}

async function currentUserId() {
  return (await supabase.auth.getUser()).data.user?.id ?? null;
}

/** Marca uma tarefa como concluída (ou reabre). */
export async function setTaskCompleted(taskId: string, completed: boolean) {
  const { error } = await supabase
    .from("patient_tasks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? await currentUserId() : null,
    })
    .eq("id", taskId);
  if (error) throw error;
}

/**
 * Conclui as tarefas em aberto de um paciente para os tipos informados.
 * Retorna os ids concluídos (para permitir desfazer).
 */
export async function completeOpenTasks(patientId: string, taskTypes: string[]): Promise<string[]> {
  if (!patientId || taskTypes.length === 0) return [];
  const { data, error } = await supabase
    .from("patient_tasks")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by: await currentUserId(),
    })
    .eq("patient_id", patientId)
    .eq("completed", false)
    .in("task_type", taskTypes)
    .select("id");
  if (error) throw error;
  return (data || []).map((t) => t.id);
}

/** Conclui as tarefas e mostra um aviso com "Desfazer". */
async function completeWithUndo(complete: () => Promise<string[]>, onChange?: () => void, successLabel?: string) {
  try {
    const ids = await complete();
    if (ids.length === 0) return;
    onChange?.();
    toast.success(
      successLabel ?? (ids.length === 1 ? "Tarefa marcada como enviada" : `${ids.length} tarefas marcadas como enviadas`),
      {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await Promise.all(ids.map((id) => setTaskCompleted(id, false)));
              onChange?.();
            } catch (error) {
              toast.error(describeError("Erro ao desfazer", error));
            }
          },
        },
      }
    );
  } catch (error) {
    toast.error(describeError("Não foi possível concluir a tarefa", error));
  }
}

/** Botão "Marcar como enviada"/"Concluir": conclui uma tarefa, com Desfazer. */
export function completeTaskWithUndo(taskId: string, onChange?: () => void, successLabel?: string) {
  return completeWithUndo(
    async () => {
      await setTaskCompleted(taskId, true);
      return [taskId];
    },
    onChange,
    successLabel
  );
}

/**
 * Chamado depois que o sistema abriu o WhatsApp com a mensagem pronta fora de
 * um card de tarefa (ex.: botões do formulário do paciente): conclui as tarefas
 * em aberto daquele tipo para o paciente, com "Desfazer" caso a mensagem não
 * tenha sido enviada de fato.
 */
export function autoCompleteAfterMessage(patientId: string, taskTypes: string[], onChange?: () => void) {
  return completeWithUndo(() => completeOpenTasks(patientId, taskTypes), onChange);
}
