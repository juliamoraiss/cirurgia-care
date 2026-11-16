// Envia notificação push (Web Push) no celular na hora de cada tarefa.
//
// Chamada a cada 5 minutos pelo pg_cron (migration 20261116200000). Busca as
// tarefas abertas cujo horário já chegou e que ainda não foram notificadas,
// envia para todos os aparelhos de admins que ativaram o sininho e marca
// notified_at para não repetir.
//
// Secrets necessários no Supabase:
//   VAPID_PUBLIC_KEY   (mesma de src/lib/push.ts)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      (opcional; contato "mailto:..." ou URL https)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tarefas com mais de 1 dia de atraso não são notificadas (evita enxurrada
// se a função ficar parada por um tempo)
const MAX_LATENESS_MS = 24 * 60 * 60 * 1000;
// Acima disso, manda um resumo em vez de uma notificação por tarefa
const MAX_INDIVIDUAL = 3;

const TASK_TYPE_LABELS: Record<string, string> = {
  exam_followup: "Cobrança de exame",
  pre_op_instructions: "Instruções pré-op",
  post_op_instructions: "Recomendações pós-op",
  post_op_30_days: "Acompanhamento 30 dias",
  surgery_confirmation_patient: "Confirmação ao paciente",
  surgery_confirmation_doctor: "Confirmação ao médico",
  guide_expiry_reminder: "Validade da guia",
  cannula_reminder: "Troca de cânula",
  custom: "Tarefa",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timeInSaoPaulo(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

interface DueTask {
  id: string;
  title: string;
  task_type: string;
  due_date: string;
  patient_id: string;
  patient: { name: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || Deno.env.get("SUPABASE_URL")!;
    if (!publicKey || !privateKey) {
      console.error("[send-task-notifications] VAPID keys not configured");
      return json({ error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configurados" }, 500);
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const now = new Date();
    const { data: tasks, error: tasksError } = await supabase
      .from("patient_tasks")
      .select("id, title, task_type, due_date, patient_id, patient:patients(name)")
      .eq("completed", false)
      .is("notified_at", null)
      .lte("due_date", now.toISOString())
      .gte("due_date", new Date(now.getTime() - MAX_LATENESS_MS).toISOString())
      .order("due_date", { ascending: true });
    if (tasksError) throw tasksError;

    const dueTasks = (tasks ?? []) as unknown as DueTask[];
    if (dueTasks.length === 0) return json({ success: true, tasks: 0 });

    // Marca antes de enviar: se duas execuções se sobrepuserem, só uma notifica
    const { data: claimed, error: claimError } = await supabase
      .from("patient_tasks")
      .update({ notified_at: now.toISOString() })
      .in("id", dueTasks.map((t) => t.id))
      .is("notified_at", null)
      .select("id");
    if (claimError) throw claimError;
    const claimedIds = new Set((claimed ?? []).map((t) => t.id));
    const toNotify = dueTasks.filter((t) => claimedIds.has(t.id));
    if (toNotify.length === 0) return json({ success: true, tasks: 0 });

    // Aparelhos inscritos (só admins veem a tela de Tarefas)
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (admins ?? []).map((a) => a.user_id);
    const { data: tokens } = adminIds.length
      ? await supabase.from("user_push_tokens").select("id, token").eq("platform", "web").in("user_id", adminIds)
      : { data: [] as { id: string; token: string }[] };

    // Monta as mensagens
    const messages =
      toNotify.length <= MAX_INDIVIDUAL
        ? toNotify.map((t) => ({
            title: `📋 ${t.title}`,
            body: [t.patient?.name, TASK_TYPE_LABELS[t.task_type] ?? "Tarefa", timeInSaoPaulo(t.due_date)]
              .filter(Boolean)
              .join(" · "),
            url: `/patients/${t.patient_id}/exams`,
            tag: `task-${t.id}`,
          }))
        : [
            {
              title: `📋 ${toNotify.length} tarefas para agora`,
              body: toNotify
                .slice(0, 5)
                .map((t) => `${t.patient?.name ?? "Paciente"}: ${t.title}`)
                .join("\n"),
              url: "/tasks",
              tag: "tasks-summary",
            },
          ];

    let sent = 0;
    let failed = 0;
    const expiredTokenIds: string[] = [];

    for (const row of tokens ?? []) {
      let subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      try {
        subscription = JSON.parse(row.token);
        if (!subscription?.endpoint) throw new Error("sem endpoint");
      } catch {
        // Registro antigo (de antes do Web Push real): não serve, remove
        expiredTokenIds.push(row.id);
        continue;
      }

      for (const message of messages) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(message), { TTL: 60 * 60 });
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Inscrição expirada/cancelada no aparelho
            expiredTokenIds.push(row.id);
            break;
          }
          failed++;
          console.error("[send-task-notifications] push failed", status, (err as Error).message);
        }
      }
    }

    if (expiredTokenIds.length > 0) {
      await supabase.from("user_push_tokens").delete().in("id", expiredTokenIds);
    }

    console.log(
      `[send-task-notifications] tasks=${toNotify.length} devices=${tokens?.length ?? 0} sent=${sent} failed=${failed} removed=${expiredTokenIds.length}`
    );
    return json({ success: true, tasks: toNotify.length, devices: tokens?.length ?? 0, sent, failed });
  } catch (error) {
    console.error("[send-task-notifications] error", error);
    return json({ error: "Erro ao enviar notificações" }, 500);
  }
});
