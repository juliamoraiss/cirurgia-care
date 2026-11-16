/**
 * Efeitos de salvar um paciente (mensagens, Google Agenda, tarefas) num lugar
 * só, usados pelo formulário e pelas ações rápidas da ficha.
 *
 * Regra de segurança: NENHUMA mensagem sai sem a usuária confirmar na folha
 * SaveEffectsSheet. Aqui só montamos/abrimos o que ela marcou.
 */
import { supabase } from "@/integrations/supabase/client";
import { longDateTime } from "@/lib/dates";
import { normalizePhoneDigits } from "@/lib/phone";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";
import { autoCompleteAfterMessage } from "@/lib/tasks";

/** Telefone do Dr. André para o aviso por WhatsApp (o mesmo usado antes). */
export const DOCTOR_WHATSAPP = "61992581199";

export interface PatientSnapshot {
  id?: string;
  name: string;
  phone: string;
  procedure: string;
  hospital: string;
  surgery_date: string; // ISO (UTC) ou "" quando não há
  surgery_to_confirm?: boolean;
  status?: string;
  responsible_user_id?: string | null;
  is_oncology?: boolean;
  oncology_stage?: string;
}

// ------------------------------------------------------------------ mensagens

export function patientConfirmationMessage(p: PatientSnapshot): string {
  const d = new Date(p.surgery_date);
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Olá, ${p.name}! Tudo bem?\nPassando para confirmar que sua cirurgia foi agendada com sucesso.\n\n🗓 Data: ${date}\n⏰ Horário: ${time}\n🏥 Local: ${p.hospital || "a confirmar"}\n\nQualquer dúvida ou necessidade de ajuste, estou à disposição por aqui.`;
}

export function doctorMessage(p: PatientSnapshot): string {
  return `🏥 Nova cirurgia agendada\n\n👤 Paciente: ${p.name}\n🔬 Procedimento: ${p.procedure}\n📅 ${longDateTime(p.surgery_date)}\n🏥 Local: ${p.hospital || "a confirmar"}`;
}

// ------------------------------------------------------------------ efeitos

export type EffectKey = "patient_whatsapp" | "doctor_whatsapp" | "calendar_sync" | "calendar_delete";

export interface SaveEffect {
  key: EffectKey;
  label: string;
  /** Prévia da mensagem, quando é uma mensagem. */
  preview?: string;
  defaultChecked: boolean;
}

/**
 * O que salvar esta mudança pode disparar. Vazio = salvar direto, sem folha.
 * `before` é o estado salvo no banco (null para paciente novo).
 */
export function detectSaveEffects(before: PatientSnapshot | null, after: PatientSnapshot): SaveEffect[] {
  const effects: SaveEffect[] = [];
  const hadDate = !!before?.surgery_date;
  const hasDate = !!after.surgery_date;
  const dateChanged = hasDate && (!hadDate || new Date(before!.surgery_date).getTime() !== new Date(after.surgery_date).getTime());
  const toConfirmChanged = hasDate && !!before && !!before.surgery_to_confirm !== !!after.surgery_to_confirm;
  const hospitalChanged = hasDate && hadDate && (before!.hospital || "") !== (after.hospital || "");

  if (dateChanged || toConfirmChanged || hospitalChanged) {
    // Data "a confirmar" não é confirmação: mensagem ao paciente vem desmarcada
    if (normalizePhoneDigits(after.phone).length >= 10 && dateChanged) {
      effects.push({
        key: "patient_whatsapp",
        label: "Enviar confirmação ao paciente (WhatsApp)",
        preview: patientConfirmationMessage(after),
        defaultChecked: !after.surgery_to_confirm,
      });
    }
    if (after.responsible_user_id) {
      effects.push({
        key: "calendar_sync",
        label: hadDate ? "Atualizar o evento no Google Agenda do médico" : "Avisar o médico no Google Agenda",
        defaultChecked: true,
      });
    }
    if (dateChanged) {
      effects.push({
        key: "doctor_whatsapp",
        label: "Avisar o Dr. André pelo WhatsApp",
        preview: doctorMessage(after),
        defaultChecked: false,
      });
    }
  } else if (hadDate && !hasDate && after.responsible_user_id) {
    effects.push({ key: "calendar_delete", label: "Remover a cirurgia do Google Agenda", defaultChecked: true });
  }
  return effects;
}

// ------------------------------------------------------------------ execução

/** Registra no Histórico do paciente (aparece na linha do tempo). */
export async function logPatientEvent(patientId: string, text: string) {
  const user = (await supabase.auth.getUser()).data.user;
  await supabase.from("patient_history").insert({
    patient_id: patientId,
    field_changed: "mensagem",
    old_value: null,
    new_value: text,
    changed_by: user?.id ?? null,
  });
}

export async function syncGoogleCalendar(
  p: PatientSnapshot & { id: string },
  existingEventId: string | null
): Promise<{ ok: boolean; message?: string }> {
  try {
    const action = existingEventId ? "update" : "create";
    const { data, error } = await supabase.functions.invoke("google-calendar-create-event", {
      body: {
        action,
        patient_name: p.name,
        procedure: p.procedure,
        hospital: p.hospital || null,
        surgery_date: p.surgery_date,
        to_confirm: !!p.surgery_to_confirm,
        notes: p.is_oncology ? `Oncologia - Estágio: ${p.oncology_stage || "N/A"}` : null,
        patient_id: p.id,
        target_user_id: p.responsible_user_id,
        existing_event_id: existingEventId,
      },
    });
    const res = data as { success?: boolean; connected?: boolean; error?: string } | null;
    if (error) return { ok: false, message: "falha ao enviar para o Google Agenda" };
    if (res?.connected === false) return { ok: false, message: "o médico não está com o Google Agenda conectado" };
    if (res?.error) return { ok: false, message: res.error };
    return { ok: !!res?.success };
  } catch {
    return { ok: false, message: "erro ao sincronizar com o Google Agenda" };
  }
}

export async function deleteGoogleCalendarEvent(patientId: string, eventId: string, responsibleId: string) {
  try {
    await supabase.functions.invoke("google-calendar-create-event", {
      body: { action: "delete", existing_event_id: eventId, patient_id: patientId, target_user_id: responsibleId },
    });
  } catch (err) {
    console.warn("Could not delete Google Calendar event", err);
  }
}

/** Abre o WhatsApp com a mensagem e registra no histórico. */
export async function sendWhatsAppMessage(
  patientId: string,
  phone: string,
  text: string,
  historyLabel: string,
  completeTaskTypes: string[] = []
) {
  safeWindowOpen(createWhatsAppUrl(normalizePhoneDigits(phone), text));
  try {
    await logPatientEvent(patientId, historyLabel);
  } catch {
    /* histórico é melhor-esforço */
  }
  if (completeTaskTypes.length) void autoCompleteAfterMessage(patientId, completeTaskTypes);
}

/** Cria as tarefas de cirurgia (confirmações, pré e pós-op) se ainda não existirem. */
export async function createSurgeryTasks(patientId: string, surgeryIso: string, name: string, procedure: string, userId: string) {
  const surgery = new Date(surgeryIso);
  const preOp = new Date(surgery);
  preOp.setDate(preOp.getDate() - 1);
  preOp.setHours(0, 0, 0, 0);
  const postOp = new Date(surgery);
  postOp.setHours(postOp.getHours() + 5);
  const now = new Date().toISOString();

  const tasks = [
    { task_type: "surgery_confirmation_patient", title: "Enviar confirmação da cirurgia ao paciente", description: `Confirmar agendamento da cirurgia de ${procedure} com o paciente ${name}`, due_date: now },
    { task_type: "surgery_confirmation_doctor", title: "Enviar confirmação da cirurgia ao médico", description: `Notificar o médico sobre a cirurgia de ${procedure} do paciente ${name}`, due_date: now },
    { task_type: "pre_op_instructions", title: "Enviar instruções pré-operatórias", description: `Enviar instruções ao paciente ${name} para a cirurgia de ${procedure}`, due_date: preOp.toISOString() },
    { task_type: "post_op_instructions", title: "Enviar recomendações pós-operatórias", description: `Enviar recomendações ao paciente ${name}`, due_date: postOp.toISOString() },
  ];
  try {
    const { data: existing } = await supabase
      .from("patient_tasks")
      .select("task_type")
      .eq("patient_id", patientId)
      .eq("completed", false)
      .in("task_type", tasks.map((t) => t.task_type));
    const have = new Set((existing || []).map((t) => t.task_type));
    const missing = tasks.filter((t) => !have.has(t.task_type)).map((t) => ({ ...t, patient_id: patientId, created_by: userId }));
    if (missing.length) await supabase.from("patient_tasks").insert(missing);
  } catch (error) {
    console.error("Erro ao criar tarefas automáticas:", error);
  }
}

export interface RunEffectsResult {
  calendarWarning?: string;
  newEventId?: string | null;
}

/**
 * Executa os efeitos marcados depois que o paciente foi salvo.
 * Mensagens de WhatsApp só saem se estiverem em `selected`.
 */
export async function runSaveEffects(
  selected: Set<EffectKey>,
  p: PatientSnapshot & { id: string },
  existingEventId: string | null
): Promise<RunEffectsResult> {
  const result: RunEffectsResult = {};

  if (selected.has("calendar_sync")) {
    const res = await syncGoogleCalendar(p, existingEventId);
    if (!res.ok && res.message) result.calendarWarning = res.message;
    else await logPatientEvent(p.id, "Google Agenda do médico atualizado").catch(() => {});
  }
  if (selected.has("calendar_delete") && existingEventId && p.responsible_user_id) {
    await deleteGoogleCalendarEvent(p.id, existingEventId, p.responsible_user_id);
  }
  if (selected.has("patient_whatsapp")) {
    await sendWhatsAppMessage(p.id, p.phone, patientConfirmationMessage(p), "Confirmação da cirurgia enviada ao paciente (WhatsApp)", [
      "surgery_confirmation_patient",
    ]);
  }
  if (selected.has("doctor_whatsapp")) {
    await sendWhatsAppMessage(p.id, DOCTOR_WHATSAPP, doctorMessage(p), "Aviso da cirurgia enviado ao Dr. André (WhatsApp)", [
      "surgery_confirmation_doctor",
    ]);
  }
  return result;
}

/** Exclui o paciente, arquivos, histórico e o evento do Google Agenda. */
export async function deletePatientCompletely(patientId: string, eventId: string | null, responsibleId: string | null) {
  if (eventId && responsibleId) await deleteGoogleCalendarEvent(patientId, eventId, responsibleId);

  const { data: files } = await supabase.from("patient_files").select("file_path").eq("patient_id", patientId);
  if (files && files.length > 0) {
    await supabase.storage.from("patient-files").remove(files.map((f) => f.file_path));
  }
  await supabase.from("patient_files").delete().eq("patient_id", patientId);
  await supabase.from("patient_history").delete().eq("patient_id", patientId);
  const { error } = await supabase.from("patients").delete().eq("id", patientId);
  if (error) throw error;
}
