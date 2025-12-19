import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

// Validation functions
function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome é obrigatório' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Nome deve ter pelo menos 2 caracteres' };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: 'Nome deve ter no máximo 200 caracteres' };
  }
  // Allow letters (including accented), spaces, hyphens, and apostrophes
  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed)) {
    return { valid: false, error: 'Nome contém caracteres inválidos' };
  }
  return { valid: true };
}

function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Telefone é obrigatório' };
  }
  // Remove non-digits for validation
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    return { valid: false, error: 'Telefone deve ter 10 ou 11 dígitos' };
  }
  return { valid: true };
}

function validateProcedure(procedure: string): { valid: boolean; error?: string } {
  if (!procedure || typeof procedure !== 'string') {
    return { valid: false, error: 'Procedimento é obrigatório' };
  }
  const trimmed = procedure.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Procedimento deve ter pelo menos 2 caracteres' };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: 'Procedimento deve ter no máximo 200 caracteres' };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (isRateLimited(clientIP)) {
      console.log('Rate limit exceeded for IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde 1 minuto e tente novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { name, phone, procedure } = body;

    // Validate inputs
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return new Response(
        JSON.stringify({ error: nameValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const procedureValidation = validateProcedure(procedure);
    if (!procedureValidation.valid) {
      return new Response(
        JSON.stringify({ error: procedureValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const sanitizedName = name.trim().slice(0, 200);
    const sanitizedPhone = phone.replace(/\D/g, '').slice(0, 11);
    const sanitizedProcedure = procedure.trim().slice(0, 200);

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for recent duplicate submissions (same phone in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', sanitizedPhone)
      .gte('created_at', fiveMinutesAgo)
      .limit(1);

    if (existingPatient && existingPatient.length > 0) {
      console.log('Duplicate submission detected for phone:', sanitizedPhone);
      return new Response(
        JSON.stringify({ error: 'Cadastro já realizado recentemente. Aguarde alguns minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get a system user to use as created_by
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);

    if (adminError) {
      console.error('Error fetching admin user:', adminError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar solicitação. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdBy = adminUsers && adminUsers.length > 0 
      ? adminUsers[0].user_id 
      : '00000000-0000-0000-0000-000000000000';

    // Insert patient with sanitized data
    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert({
        name: sanitizedName,
        phone: sanitizedPhone,
        procedure: sanitizedProcedure,
        created_by: createdBy,
        status: 'awaiting_authorization',
        origem: 'Landing Page'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting patient:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao cadastrar. Tente novamente mais tarde.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Patient created successfully:', patient.id);

    return new Response(
      JSON.stringify({ success: true, patientId: patient.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente mais tarde.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
