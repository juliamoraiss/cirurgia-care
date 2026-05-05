import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Manual Bearer auth (verify_jwt = false)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.length > 5000) {
      return new Response(JSON.stringify({ error: "Texto inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Today in São Paulo timezone for relative date interpretation
    const nowSP = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const systemPrompt = `Você extrai informações de cirurgias de mensagens de WhatsApp em português brasileiro.
Hoje é: ${nowSP} (timezone America/Sao_Paulo).
Interprete datas relativas como "amanhã", "sexta", "próxima terça", "20/05", "às 14h", etc.
Retorne data/hora SEMPRE no formato ISO 8601 com offset -03:00 (ex: "2026-05-20T08:00:00-03:00").
Se algum campo não estiver presente na mensagem, retorne null.
Confidence: "high" quando a informação está clara e explícita, "medium" quando inferida razoavelmente, "low" quando duvidoso.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_surgery",
              description: "Extrai dados da cirurgia da mensagem",
              parameters: {
                type: "object",
                properties: {
                  patient_name: { type: ["string", "null"], description: "Nome completo do paciente" },
                  procedure: { type: ["string", "null"], description: "Nome do procedimento cirúrgico" },
                  hospital: { type: ["string", "null"], description: "Nome do hospital ou clínica" },
                  surgery_datetime: { type: ["string", "null"], description: "Data e hora da cirurgia em ISO 8601 com offset -03:00" },
                  doctor_name: { type: ["string", "null"], description: "Nome do médico responsável, se mencionado" },
                  confidence: {
                    type: "object",
                    properties: {
                      patient_name: { type: "string", enum: ["high", "medium", "low", "none"] },
                      procedure: { type: "string", enum: ["high", "medium", "low", "none"] },
                      hospital: { type: "string", enum: ["high", "medium", "low", "none"] },
                      surgery_datetime: { type: "string", enum: ["high", "medium", "low", "none"] },
                      doctor_name: { type: "string", enum: ["high", "medium", "low", "none"] },
                    },
                    required: ["patient_name", "procedure", "hospital", "surgery_datetime", "doctor_name"],
                    additionalProperties: false,
                  },
                },
                required: ["patient_name", "procedure", "hospital", "surgery_datetime", "doctor_name", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_surgery" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-surgery-message error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
