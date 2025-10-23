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

    console.log('Checking for daily tasks to notify...');

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all incomplete tasks due today
    const { data: tasks, error: tasksError } = await supabase
      .from('patient_tasks')
      .select('*, patients(name)')
      .eq('completed', false)
      .gte('due_date', today.toISOString())
      .lt('due_date', tomorrow.toISOString());

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks for today`);

    // Get all admin users to notify
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Send notifications to all admins
    const notificationPromises = (profiles || []).map(async (profile) => {
      return supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: profile.user_id,
          title: 'Tarefas do Dia',
          body: `Você tem ${tasks?.length || 0} tarefa(s) para hoje`,
          data: {
            type: 'daily_tasks',
            count: String(tasks?.length || 0)
          }
        }
      });
    });

    await Promise.all(notificationPromises);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasks_count: tasks?.length || 0,
        notifications_sent: profiles?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in notify-daily-tasks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
