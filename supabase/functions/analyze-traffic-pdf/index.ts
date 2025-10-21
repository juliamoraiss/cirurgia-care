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
    console.log('=== INÍCIO DO PROCESSAMENTO ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log('1. Cliente Supabase criado');

    const formData = await req.formData();
    console.log('2. FormData recebido');

    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string) || '';
    const text = formData.get('text') as string | null;
    const pdfFileName = formData.get('pdfFileName') as string | null;

    console.log('3. Dados do form:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      hasText: !!text,
      textLength: text?.length,
      pdfFileName,
      userId
    });

    // Fallback: quando recebemos texto extraído do PDF (client-side)
    if (!file && text) {
      console.log('4. MODO TEXTO - Analisando texto extraído...');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

      if (!LOVABLE_API_KEY) {
        console.error('LOVABLE_API_KEY não configurada!');
        return new Response(JSON.stringify({ error: 'Configuração de API incompleta' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const buildBody = (model: string) => ({
        model,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em análise de relatórios de leads. Extraia as seguintes informações do texto e retorne APENAS um objeto JSON válido sem formatação markdown: period_start (YYYY-MM-DD), period_end (YYYY-MM-DD), total_leads, scheduled_appointments, not_scheduled, awaiting_response, no_continuity, no_contact_after_attempts, leads_outside_brasilia, active_leads, in_progress, concierge_name, scheduled_patients (array com os nomes completos dos pacientes que foram agendados). Use null quando ausente.'
          },
          {
            role: 'user',
            content: [{ type: 'text', text: text.slice(0, 100000) }]
          }
        ]
      });

      console.log('5. Chamando IA com modelo gemini-2.5-flash...');
      let aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBody('google/gemini-2.5-flash')),
      });

      if (!aiResponse.ok) {
        const t1 = await aiResponse.text();
        console.error('6. Erro texto tentativa 1:', aiResponse.status, t1);
        console.log('7. Tentando com gemini-2.5-pro...');
        
        aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBody('google/gemini-2.5-pro')),
        });
      }

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('8. ERRO FINAL (texto):', aiResponse.status, errorText);
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: 'Limite de requisições de IA excedido. Aguarde e tente novamente.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: 'Erro ao analisar texto do PDF.', details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('9. Resposta da IA recebida (texto)');
      const aiData = await aiResponse.json();
      console.log('10. Dados da IA:', JSON.stringify(aiData).slice(0, 500));

      let extractedData;
      try {
        const content = aiData.choices?.[0]?.message?.content ?? '';
        console.log('11. Conteúdo recebido:', content.slice(0, 200));
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
        console.log('12. Dados extraídos:', extractedData);
      } catch (e) {
        console.error('13. ERRO ao parsear resposta:', e);
        return new Response(JSON.stringify({ error: 'Não foi possível extrair dados do texto do PDF.', details: String(e) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('14. Inserindo dados no banco...');
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
          pdf_file_path: null,
          pdf_file_name: pdfFileName,
          raw_data: extractedData,
          created_by: userId
        })
        .select()
        .single();

      if (insertError) {
        console.error('15. ERRO ao inserir (texto):', insertError);
        return new Response(JSON.stringify({ error: 'Erro ao salvar dados do relatório.', details: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('16. Sucesso! Dados salvos:', reportData.id);

      // Criar pacientes agendados
      if (extractedData.scheduled_patients && Array.isArray(extractedData.scheduled_patients)) {
        console.log('16.1 Criando pacientes agendados:', extractedData.scheduled_patients.length);
        
        for (const patientName of extractedData.scheduled_patients) {
          if (patientName && typeof patientName === 'string' && patientName.trim()) {
            try {
              const { error: patientError } = await supabaseClient
                .from('patients')
                .insert({
                  name: patientName.trim(),
                  procedure: 'simpatectomia',
                  origem: 'trafego pago',
                  status: 'awaiting_authorization',
                  created_by: userId
                });

              if (patientError) {
                console.error('16.2 Erro ao criar paciente:', patientName, patientError);
              } else {
                console.log('16.3 Paciente criado:', patientName);
              }
            } catch (err) {
              console.error('16.4 Erro ao processar paciente:', patientName, err);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, data: reportData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // MODO PDF
    if (!file) {
      console.error('17. ERRO: Arquivo PDF não fornecido');
      throw new Error('Arquivo PDF não fornecido');
    }

    console.log('18. MODO PDF - Iniciando upload...');
    
    // Validar tipo de arquivo
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      console.error('19. ERRO: Arquivo não é PDF', file.type);
      return new Response(JSON.stringify({ 
        error: 'Arquivo inválido. Por favor, envie um arquivo PDF.',
        fileType: file.type 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('20. ERRO: Arquivo muito grande', file.size);
      return new Response(JSON.stringify({ 
        error: 'Arquivo muito grande. Tamanho máximo: 10MB',
        fileSize: file.size 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('21. Sanitizando nome do arquivo...');
    const sanitizedFileName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    
    console.log('22. Nome sanitizado:', fileName);
    console.log('23. Fazendo upload para bucket traffic-reports...');

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('traffic-reports')
      .upload(fileName, file, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('24. ERRO NO UPLOAD:', uploadError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao fazer upload do PDF',
        details: uploadError.message,
        bucket: 'traffic-reports'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('25. Upload bem-sucedido:', uploadData.path);
    console.log('26. Gerando URL assinada...');

    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('traffic-reports')
      .createSignedUrl(uploadData.path, 300);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('27. ERRO ao gerar URL assinada:', signedUrlError);
      throw new Error('Não foi possível gerar URL assinada para o PDF');
    }

    console.log('28. URL assinada gerada (primeiros 50 chars):', signedUrlData.signedUrl.slice(0, 50));
    console.log('29. Analisando PDF com IA...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('30. LOVABLE_API_KEY não configurada!');
      return new Response(JSON.stringify({ error: 'Configuração de API incompleta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analyzeWithAI = async (model: string, attempt: number) => {
      console.log(`31.${attempt} Tentativa ${attempt} com modelo ${model}...`);
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
              content: 'Você é um assistente especializado em análise de relatórios de leads. Extraia as seguintes informações do PDF e retorne APENAS um objeto JSON válido sem formatação markdown: period_start (data início do período YYYY-MM-DD), period_end (data fim do período YYYY-MM-DD), total_leads (número total de leads), scheduled_appointments (agendamentos realizados), not_scheduled (não agendados), awaiting_response (aguardando resposta), no_continuity (quantos não deram continuidade), no_contact_after_attempts (quantos não responderam após tentativas), leads_outside_brasilia (leads de fora de Brasília), active_leads (leads ativos), in_progress (em progresso), concierge_name (nome do concierge/responsável), scheduled_patients (array com os nomes completos dos pacientes que foram agendados). Se algum dado não estiver disponível, use null.'
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

    let aiResponse = await analyzeWithAI('google/gemini-2.5-flash', 1);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('32. Erro na tentativa 1:', aiResponse.status, errorText.slice(0, 500));

      if (aiResponse.status === 400 && errorText.includes('Failed to extract')) {
        console.log('33. Tentando novamente com modelo Pro...');
        aiResponse = await analyzeWithAI('google/gemini-2.5-pro', 2);
      }
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('34. ERRO FINAL na API de IA:', aiResponse.status, errorText.slice(0, 500));

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
          details: 'Este PDF parece ser uma imagem escaneada. Por favor, gere um novo PDF com texto selecionável.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        error: 'Erro ao processar o PDF com IA',
        details: errorText.slice(0, 200),
        status: aiResponse.status
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('35. Resposta da IA recebida');
    const aiData = await aiResponse.json();
    console.log('36. Dados da IA:', JSON.stringify(aiData).slice(0, 500));
    
    let extractedData;
    try {
      const content = aiData.choices[0].message.content;
      console.log('37. Conteúdo da IA:', content.slice(0, 200));
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
      console.log('38. Dados extraídos:', extractedData);
    } catch (parseError) {
      console.error('39. ERRO ao parsear resposta da IA:', parseError);
      throw new Error('Não foi possível extrair dados estruturados do PDF');
    }

    console.log('40. Inserindo dados no banco...');
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
      console.error('41. ERRO ao inserir no banco:', insertError);
      throw insertError;
    }

    console.log('42. SUCESSO! Dados salvos:', reportData.id);

    // Criar pacientes agendados
    if (extractedData.scheduled_patients && Array.isArray(extractedData.scheduled_patients)) {
      console.log('42.1 Criando pacientes agendados:', extractedData.scheduled_patients.length);
      
      for (const patientName of extractedData.scheduled_patients) {
        if (patientName && typeof patientName === 'string' && patientName.trim()) {
          try {
            const { error: patientError } = await supabaseClient
              .from('patients')
              .insert({
                name: patientName.trim(),
                procedure: 'simpatectomia',
                origem: 'trafego pago',
                status: 'awaiting_authorization',
                created_by: userId
              });

            if (patientError) {
              console.error('42.2 Erro ao criar paciente:', patientName, patientError);
            } else {
              console.log('42.3 Paciente criado:', patientName);
            }
          } catch (err) {
            console.error('42.4 Erro ao processar paciente:', patientName, err);
          }
        }
      }
    }

    console.log('=== FIM DO PROCESSAMENTO ===');

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERRO NA FUNÇÃO ===', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});