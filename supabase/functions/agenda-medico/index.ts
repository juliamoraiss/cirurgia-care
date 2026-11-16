// Endpoint para consultar os horários OCUPADOS da agenda Google do médico padrão.
// Feito para automações externas que não conseguem enviar cabeçalho Authorization.
//
// Proteção: chave secreta no parâmetro ?segredo=... (configurada no secret AGENDA_MEDICO_SECRET).
// Privacidade: retorna só início/fim de cada horário ocupado — nunca título, paciente ou descrição.
//
// Uso:
//   GET /functions/v1/agenda-medico?segredo=XXX                       → próximos 30 dias
//   GET /functions/v1/agenda-medico?segredo=XXX&data=2026-11-20        → um dia
//   GET /functions/v1/agenda-medico?segredo=XXX&inicio=2026-11-20&fim=2026-11-27

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dr. André Morais Alves (mesmo valor de src/lib/defaults.ts)
const DOCTOR_ID = "4537559e-87e3-4656-8cf0-aa109714b6a8";
const TIMEZONE = "America/Sao_Paulo";
const MAX_RANGE_DAYS = 90;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// "YYYY-MM-DD" interpretado no fuso de Brasília (UTC-3, sem horário de verão)
function startOfDayBrasilia(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

function formatBrasilia(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { data: `${get("year")}-${get("month")}-${get("day")}`, hora: `${get("hour")}:${get("minute")}` };
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    console.error("[agenda-medico] Token refresh failed:", await response.text());
    return null;
  }
  return (await response.json()) as { access_token: string; expires_in: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const expectedSecret = Deno.env.get("AGENDA_MEDICO_SECRET");
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!expectedSecret || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: "Endpoint não configurado" }, 500);
    }

    // Parâmetros podem vir na URL (GET) ou no corpo JSON (POST)
    const url = new URL(req.url);
    let params: Record<string, string | undefined> = Object.fromEntries(url.searchParams.entries());
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body === "object") params = { ...params, ...body };
      } catch {
        // corpo vazio ou inválido: segue só com a URL
      }
    }

    const providedSecret = String(params.segredo ?? "");
    if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
      return json({ error: "Não autorizado" }, 401);
    }

    // Período consultado
    let timeMin: Date;
    let timeMax: Date;
    if (params.data) {
      const d = startOfDayBrasilia(String(params.data));
      if (!d) return json({ error: "Parâmetro 'data' inválido. Use AAAA-MM-DD." }, 400);
      timeMin = d;
      timeMax = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    } else if (params.inicio || params.fim) {
      const ini = params.inicio ? startOfDayBrasilia(String(params.inicio)) : new Date();
      const fimDia = params.fim ? startOfDayBrasilia(String(params.fim)) : null;
      if (!ini || (params.fim && !fimDia)) {
        return json({ error: "Parâmetros 'inicio'/'fim' inválidos. Use AAAA-MM-DD." }, 400);
      }
      timeMin = ini;
      // 'fim' é inclusivo: vai até o fim daquele dia
      timeMax = fimDia
        ? new Date(fimDia.getTime() + 24 * 60 * 60 * 1000)
        : new Date(ini.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      timeMin = new Date();
      timeMax = new Date(timeMin.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    if (timeMax <= timeMin) return json({ error: "'fim' deve ser depois de 'inicio'" }, 400);
    if (timeMax.getTime() - timeMin.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return json({ error: `Período máximo é de ${MAX_RANGE_DAYS} dias` }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("user_id", DOCTOR_ID)
      .single();

    if (!connection) {
      return json({ error: "Google Agenda do médico não está conectado" }, 503);
    }

    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(connection.refresh_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      if (!refreshed) return json({ error: "Conexão com Google Agenda expirou. Reconecte no app." }, 503);
      accessToken = refreshed.access_token;
      await supabase
        .from("google_calendar_connections")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", DOCTOR_ID);
    }

    // Pede ao Google só os campos de horário — título/descrição nem chegam aqui
    const query = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      fields: "items(start,end,status,transparency)",
    });
    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!calRes.ok) {
      console.error(`[agenda-medico] Google API error [${calRes.status}]:`, await calRes.text());
      return json({ error: "Falha ao consultar o Google Agenda" }, 502);
    }

    const calData = await calRes.json();
    const ocupados = (calData.items || [])
      .filter((e: any) => e.status !== "cancelled" && e.transparency !== "transparent")
      .map((e: any) => {
        const diaInteiro = !!e.start?.date;
        const inicio = diaInteiro ? startOfDayBrasilia(e.start.date)!.toISOString() : e.start.dateTime;
        const fim = diaInteiro ? startOfDayBrasilia(e.end.date)!.toISOString() : e.end.dateTime;
        const ini = formatBrasilia(inicio);
        const end = formatBrasilia(fim);
        return {
          inicio,
          fim,
          dia_inteiro: diaInteiro,
          data: ini.data,
          hora_inicio: diaInteiro ? null : ini.hora,
          hora_fim: diaInteiro ? null : end.hora,
        };
      });

    return json({
      fuso_horario: TIMEZONE,
      periodo: { inicio: timeMin.toISOString(), fim: timeMax.toISOString() },
      ocupados,
      consultado_em: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[agenda-medico] Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
