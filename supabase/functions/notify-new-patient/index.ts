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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { patient_name, procedure } = await req.json();

    console.log('Notifying admins about new patient:', patient_name);

    // Get all admin users
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      console.log('No admin users found');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Send notification to each admin
    const notificationPromises = admins.map(admin => 
      supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: admin.user_id,
          title: 'Novo Paciente',
          body: `${patient_name} foi cadastrado - ${procedure}`,
          data: {
            type: 'new_patient',
            patient_name,
            procedure,
          }
        }
      })
    );

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => !r.error).length;

    console.log(`Notifications sent to ${successCount}/${admins.length} admins`);

    return new Response(
      JSON.stringify({ 
        success: true,
        admins_notified: successCount,
        total_admins: admins.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in notify-new-patient:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
