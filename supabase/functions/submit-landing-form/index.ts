import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone, procedure } = await req.json();

    // Validate required fields
    if (!name || !phone || !procedure) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get a system user to use as created_by
    // First, check if there's an admin user
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);

    if (adminError) {
      console.error('Error fetching admin user:', adminError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar solicitação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdBy = adminUsers && adminUsers.length > 0 
      ? adminUsers[0].user_id 
      : '00000000-0000-0000-0000-000000000000';

    // Insert patient
    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert({
        name,
        phone,
        procedure,
        created_by: createdBy,
        status: 'awaiting_authorization'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting patient:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao cadastrar paciente' }),
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
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
