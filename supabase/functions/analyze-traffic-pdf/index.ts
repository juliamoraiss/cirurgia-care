import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      throw new Error('Arquivo PDF não fornecido');
    }

    console.log('Fazendo upload do PDF para o storage...');
    // Sanitize filename: remove special characters, spaces, and accents
    const sanitizedFileName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace special chars with underscore
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('traffic-reports')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw uploadError;
    }

    // Create a short-lived signed URL so the AI can fetch the PDF directly
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('traffic-reports')
      .createSignedUrl(uploadData.path, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Erro ao gerar URL assinada:', signedUrlError);
      throw new Error('Não foi possível gerar URL assinada para o PDF');
    }

    console.log('Analisando PDF com IA...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Função auxiliar para chamar a API de IA
    const analyzeWithAI = async (model: string, attempt: number) => {
      console.log(`Tentativa ${attempt} com modelo ${model}...`);
      return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em análise de relatórios de leads. Extraia as seguintes informações do PDF e retorne APENAS um objeto JSON válido sem formatação markdown: period_start (data início do período YYYY-MM-DD), period_end (data fim do período YYYY-MM-DD), total_leads (número total de leads), scheduled_appointments (agendamentos realizados), not_scheduled (não agendados), awaiting_response (aguardando resposta), no_continuity (quantos não deram continuidade), no_contact_after_attempts (quantos não responderam após tentativas), leads_outside_brasilia (leads de fora de Brasília), active_leads (leads ativos), in_progress (em progresso), concierge_name (nome do concierge/responsável). Se algum dado não estiver disponível, use null.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analise este relatório (PDF) e extraia as informações solicitadas.' },
                {
                  type: 'image_url',
                  image_url: {
                    url: signedUrlData.signedUrl,
                  }
                }
              ]
            }
          ]
        }),
      });
    };

    // Tentativa 1: gemini-2.5-flash (mais rápido)
    let aiResponse = await analyzeWithAI('google/gemini-2.5-flash', 1);

    // Se falhar com erro 400 de extração de imagem, tenta com modelo Pro
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na tentativa 1:', aiResponse.status, errorText);

      if (aiResponse.status === 400 && errorText.includes('Failed to extract')) {
        console.log('Tentando novamente com modelo Pro...');
        aiResponse = await analyzeWithAI('google/gemini-2.5-pro', 2);
      }
    }

    // Verificar resultado final
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro final na API de IA:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requisições de IA excedido. Aguarde alguns instantes e tente novamente.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Créditos de IA esgotados. Entre em contato com o administrador.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 400 && errorText.includes('Failed to extract')) {
        return new Response(JSON.stringify({
          error: 'PDF não pode ser processado',
          details: 'Este PDF parece ser uma imagem escaneada. Por favor, gere um novo PDF com texto selecionável ou exporte as páginas como imagens PNG/JPG e tente novamente.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao processar o PDF. Verifique se o arquivo está correto e tente novamente.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    console.log('Resposta da IA:', aiData);
    
    let extractedData;
    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Erro ao parsear resposta da IA:', parseError);
      throw new Error('Não foi possível extrair dados estruturados do PDF');
    }

    console.log('Dados extraídos:', extractedData);

    const { data: reportData, error: insertError } = await supabaseClient
      .from('paid_traffic_reports')
      .insert({
        report_date: extractedData.period_end || extractedData.period_start,
        platform: 'Leads',
        period_start: extractedData.period_start,
        period_end: extractedData.period_end,
        total_leads: extractedData.total_leads,
        scheduled_appointments: extractedData.scheduled_appointments,
        not_scheduled: extractedData.not_scheduled,
        awaiting_response: extractedData.awaiting_response,
        no_continuity: extractedData.no_continuity,
        no_contact_after_attempts: extractedData.no_contact_after_attempts,
        leads_outside_brasilia: extractedData.leads_outside_brasilia,
        active_leads: extractedData.active_leads,
        in_progress: extractedData.in_progress,
        concierge_name: extractedData.concierge_name,
        pdf_file_path: uploadData.path,
        pdf_file_name: file.name,
        raw_data: extractedData,
        created_by: userId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir no banco:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});